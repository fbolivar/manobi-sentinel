import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { EventosService } from '../eventos-climaticos/eventos.service';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Cliente IDEAM — dos modos configurables por IDEAM_MODE:
 *
 * - `simulado` (default): genera eventos sintéticos aleatorios sobre Colombia.
 * - `real`: consulta la API SODA de datos abiertos
 *   (https://www.datos.gov.co/resource/sbwg-7ju4.json — Datos hidrometeorológicos
 *    crudos de estaciones IDEAM) y normaliza a `eventos_climaticos`.
 *
 * En `real`, si la llamada falla (red caída / estructura cambió), cae
 * automáticamente al modo simulado para no dejar el motor sin datos.
 */
type IdeamTipo = 'lluvia' | 'viento' | 'temperatura' | 'humedad' | 'presion';

interface SodaDataset {
  id: string;
  tipo: IdeamTipo;
  unidad: string;
  factor?: number;
  min?: number;
  max?: number;
}

export interface PollStatus {
  ultimo_poll: string | null;
  ultimo_total: number;
  ultimo_modo: string;
  proximo_poll: string;
}

@Injectable()
export class IdeamService {
  private readonly log = new Logger('IDEAM');
  private readonly SODA_BASE = 'https://www.datos.gov.co/resource';
  private readonly SODA_LIMIT = 500;
  private readonly SODA_SINCE_HOURS = 48;

  private lastPollAt: Date | null = null;
  private lastPollTotal = 0;
  private lastPollModo = 'simulado';

  private readonly DATASETS: SodaDataset[] = [
    { id: 'sbwg-7ju4', tipo: 'temperatura', unidad: '°C',   min: -10, max: 55 },
    { id: 'uext-mhny', tipo: 'humedad',     unidad: '%',    min: 0,   max: 100 },
    { id: 's54a-sgyg', tipo: 'lluvia',      unidad: 'mm',   min: 0,   max: 500 },
    { id: 'sgfv-3yp8', tipo: 'viento',      unidad: 'km/h', factor: 3.6, min: 0, max: 150 },
    { id: '62tk-nxj5', tipo: 'presion',     unidad: 'hPa',  min: 500, max: 1100 },
  ];

  constructor(
    private readonly cfg: ConfigService,
    private readonly http: HttpService,
    private readonly eventos: EventosService,
    private readonly metrics: MetricsService,
  ) {}

  // CRON desactivado: fuente de datos reemplazada por OroraTech (evita duplicidad)
  // Para importar manualmente: POST /ideam/poll
  async poll(): Promise<{ insertados: number; modo: string; porTipo?: Record<string, number> }> {
    const mode = this.cfg.get<string>('ideam.mode');
    let result: { insertados: number; modo: string; porTipo?: Record<string, number> };

    if (mode === 'real') {
      try {
        const { total, porTipo } = await this.pollReal();
        this.log.log(`IDEAM real: ${total} eventos (${JSON.stringify(porTipo)})`);
        this.metrics.ideamPolls.inc({ modo: 'real', status: 'ok' });
        for (const [tipo, n] of Object.entries(porTipo)) this.metrics.ideamEvents.inc({ tipo }, n);
        result = { insertados: total, modo: 'real', porTipo };
      } catch (e) {
        this.log.warn(`IDEAM real falló (${(e as Error).message}), fallback a simulado`);
        this.metrics.ideamPolls.inc({ modo: 'real', status: 'error' });
        const n = await this.pollSimulado();
        this.metrics.ideamPolls.inc({ modo: 'simulado', status: 'ok' });
        result = { insertados: n, modo: 'simulado-fallback' };
      }
    } else {
      const n = await this.pollSimulado();
      this.metrics.ideamPolls.inc({ modo: 'simulado', status: 'ok' });
      this.metrics.ideamEvents.inc({ tipo: 'lluvia' }, n);
      result = { insertados: n, modo: 'simulado' };
    }

    this.lastPollAt = new Date();
    this.lastPollTotal = result.insertados;
    this.lastPollModo = result.modo;
    return result;
  }

  status(): PollStatus {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 30 - (next.getMinutes() % 30), 0, 0);
    return {
      ultimo_poll: this.lastPollAt?.toISOString() ?? null,
      ultimo_total: this.lastPollTotal,
      ultimo_modo: this.lastPollModo,
      proximo_poll: next.toISOString(),
    };
  }

  private async pollReal(): Promise<{ total: number; porTipo: Record<string, number> }> {
    const since = new Date(Date.now() - this.SODA_SINCE_HOURS * 3600 * 1000).toISOString().replace(/Z$/, '');
    const porTipo: Record<string, number> = {};
    let total = 0;

    for (const ds of this.DATASETS) {
      try {
        const inserted = await this.pollDataset(ds, since);
        porTipo[ds.tipo] = (porTipo[ds.tipo] ?? 0) + inserted;
        total += inserted;
      } catch (e) {
        this.log.warn(`SODA ${ds.id} (${ds.tipo}) falló: ${(e as Error).message}`);
        porTipo[ds.tipo] = porTipo[ds.tipo] ?? 0;
      }
    }
    return { total, porTipo };
  }

  private async pollDataset(ds: SodaDataset, since: string): Promise<number> {
    const u = new URL(`${this.SODA_BASE}/${ds.id}.json`);
    u.searchParams.set('$limit', String(this.SODA_LIMIT));
    u.searchParams.set('$where', `fechaobservacion > '${since}'`);
    u.searchParams.set('$order', 'fechaobservacion DESC');
    const { data } = await firstValueFrom(this.http.get<IdeamRow[]>(u.toString(), { timeout: 20_000 }));
    if (!Array.isArray(data)) throw new Error('respuesta SODA inválida');

    const mapped = data
      .map((row) => this.mapSodaRow(row, ds))
      .filter((m): m is NonNullable<typeof m> => m !== null);
    try {
      return await this.eventos.createMany(mapped);
    } catch (e) {
      this.log.warn(`bulk insert ${ds.id} falló: ${(e as Error).message}`);
      return 0;
    }
  }

  private mapSodaRow(r: IdeamRow, ds: SodaDataset) {
    const lon = Number(r.longitud);
    const lat = Number(r.latitud);
    if (!isFinite(lon) || !isFinite(lat)) return null;

    const raw = Number(r.valorobservado);
    if (!isFinite(raw)) return null;
    const intensidad = ds.factor != null ? raw * ds.factor : raw;
    if (ds.min != null && intensidad < ds.min) return null;
    if (ds.max != null && intensidad > ds.max) return null;

    return {
      tipo: ds.tipo,
      intensidad,
      unidad: ds.unidad,
      fecha: new Date(r.fechaobservacion ?? Date.now()).toISOString(),
      ubicacion: { type: 'Point' as const, coordinates: [lon, lat] },
      fuente: `IDEAM-${r.codigoestacion ?? 'XX'}`,
      datos_raw: r as unknown as Record<string, unknown>,
    };
  }

  private async pollSimulado(): Promise<number> {
    let ok = 0;
    for (let i = 0; i < 5; i++) {
      const lon = -78 + Math.random() * 12;
      const lat = -3 + Math.random() * 15;
      const intensidad = Math.random() * 40;
      try {
        await this.eventos.create({
          tipo: 'lluvia',
          intensidad,
          unidad: 'mm/h',
          fecha: new Date().toISOString(),
          ubicacion: { type: 'Point', coordinates: [lon, lat] },
          fuente: 'IDEAM-SIM',
          datos_raw: {
            temperatura_c: 18 + Math.random() * 18,
            humedad_relativa: 30 + Math.random() * 65,
          },
        });
        ok++;
      } catch { /* ignore */ }
    }
    return ok;
  }

  async pollNow() { return this.poll(); }
}

interface IdeamRow {
  codigoestacion?: string;
  descripcionsensor?: string;
  fechaobservacion?: string;
  valorobservado?: string | number;
  unidadmedida?: string;
  latitud?: string | number;
  longitud?: string | number;
}
