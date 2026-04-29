import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Parque } from '../common/entities/parque.entity';
import { EventosService } from '../eventos-climaticos/eventos.service';
import { AlertasService } from '../alertas/alertas.service';
import { MetricsService } from '../metrics/metrics.service';
import { OroraTechService } from './ororatech.service';
import { HotspotData } from './hotspot.interface';
import { AlertsGateway } from '../alertas/alerts.gateway';

@Injectable()
export class HotspotsService {
  private readonly log = new Logger('Hotspots');

  constructor(
    private readonly orora: OroraTechService,
    private readonly eventos: EventosService,
    private readonly alertas: AlertasService,
    private readonly metrics: MetricsService,
    private readonly ds: DataSource,
    @InjectRepository(Parque) private readonly parques: Repository<Parque>,
    private readonly gateway: AlertsGateway,
  ) {}

  @Cron('0 */30 * * * *', { name: 'hotspots', timeZone: 'America/Bogota' })
  async poll() {
    const hotspots = await this.orora.poll();
    this.log.log(`Hotspots OroraTech: ${hotspots.length}`);

    if (hotspots.length === 0) return { total: 0, alertas: 0 };

    const inserted = await this.persistir(hotspots);
    const alertasGen = await this.evaluar(hotspots);

    this.metrics.ideamEvents.inc({ tipo: 'hotspot_orora' }, hotspots.length);
    this.gateway.broadcastHotspots(hotspots.length);

    return { total: inserted, alertas: alertasGen };
  }

  private async persistir(hotspots: HotspotData[]): Promise<number> {
    const mapped = hotspots.map((h) => ({
      tipo: 'incendio' as const,
      intensidad: h.intensidad_frp,
      unidad: 'MW',
      fecha: h.fecha.toISOString(),
      ubicacion: { type: 'Point' as const, coordinates: [h.longitud, h.latitud] },
      fuente: `${h.fuente}-${h.satelite}`,
      datos_raw: {
        ...h.datos_raw,
        confianza: h.confianza,
        fuente_hotspot: h.fuente,
      },
    }));
    return this.eventos.createMany(mapped);
  }

  private async evaluar(hotspots: HotspotData[]): Promise<number> {
    let generadas = 0;
    const parques = await this.parques.find();

    for (const h of hotspots) {
      if (h.confianza < 40) continue;

      const parque = await this.findParqueContaining(h.latitud, h.longitud, parques);
      if (!parque) continue;

      const nivel = h.confianza > 70 ? 'rojo' : 'amarillo';
      const tipo = h.confianza > 70 ? 'Incendio satelital' : 'Anomalía térmica';
      const desc = [
        `Detección: ${h.fuente} (${h.satelite})`,
        `FRP: ${h.intensidad_frp} MW | Confianza: ${h.confianza}%`,
        `Coordenadas: ${h.latitud.toFixed(5)}, ${h.longitud.toFixed(5)}`,
        `Fecha: ${h.fecha.toISOString()}`,
      ].join('\n');

      try {
        await this.alertas.create({
          tipo,
          nivel: nivel as 'rojo' | 'amarillo',
          descripcion: desc,
          fecha_inicio: h.fecha.toISOString(),
          parque_id: parque.id,
        }, 'motor_reglas');
        this.metrics.alertsGenerated.inc({ nivel });
        generadas++;
      } catch (e) {
        this.log.debug(`Dedup/error: ${(e as Error).message}`);
      }
    }
    return generadas;
  }

  private async findParqueContaining(lat: number, lon: number, _cache: Parque[]): Promise<Parque | null> {
    const rows = await this.ds.query(
      `SELECT id, nombre FROM parques WHERE ST_Contains(geometria, ST_SetSRID(ST_Point($1, $2), 4326)) LIMIT 1`,
      [lon, lat],
    );
    return rows[0] ?? null;
  }

  async pollNow() { return this.poll(); }
}
