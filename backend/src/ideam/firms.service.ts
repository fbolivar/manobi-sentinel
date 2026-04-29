import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { EventosService } from '../eventos-climaticos/eventos.service';
import { MetricsService } from '../metrics/metrics.service';

const COL_BBOX = { minLon: -79.5, maxLon: -66.8, minLat: -4.2, maxLat: 13.5 };

const FIRMS_URLS = [
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_America_24h.csv',
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_America_24h.csv',
];

interface FirmsRow {
  latitude: string; longitude: string; brightness: string;
  confidence: string; frp: string; acq_date: string;
  acq_time: string; satellite: string; daynight: string;
}

export interface FirmsStatus {
  ultimo_poll: string | null;
  ultimo_total: number;
  proximo_poll: string;
}

@Injectable()
export class FirmsService {
  private readonly log = new Logger('FIRMS');
  private lastPollAt: Date | null = null;
  private lastPollTotal = 0;

  constructor(
    private readonly http: HttpService,
    private readonly eventos: EventosService,
    private readonly metrics: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { timeZone: 'America/Bogota' })
  async poll(): Promise<{ insertados: number }> {
    let total = 0;
    for (const url of FIRMS_URLS) {
      try {
        const n = await this.pollUrl(url);
        total += n;
      } catch (e) {
        this.log.warn(`FIRMS ${url.split('/').pop()} falló: ${(e as Error).message}`);
      }
    }
    this.log.log(`FIRMS: ${total} focos de calor en Colombia`);
    this.metrics.ideamEvents.inc({ tipo: 'firms_incendio' }, total);
    this.lastPollAt = new Date();
    this.lastPollTotal = total;
    return { insertados: total };
  }

  status(): FirmsStatus {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return {
      ultimo_poll: this.lastPollAt?.toISOString() ?? null,
      ultimo_total: this.lastPollTotal,
      proximo_poll: next.toISOString(),
    };
  }

  private async pollUrl(url: string): Promise<number> {
    const { data: csv } = await firstValueFrom(
      this.http.get<string>(url, { timeout: 30_000, responseType: 'text' as never }),
    );
    const lines = (csv as string).split('\n').slice(1).filter(Boolean);
    const colRows: FirmsRow[] = [];

    for (const line of lines) {
      const cols = line.split(',');
      const lat = Number(cols[0]);
      const lon = Number(cols[1]);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      if (lat < COL_BBOX.minLat || lat > COL_BBOX.maxLat) continue;
      if (lon < COL_BBOX.minLon || lon > COL_BBOX.maxLon) continue;
      colRows.push({
        latitude: cols[0], longitude: cols[1], brightness: cols[2],
        confidence: cols[8], frp: cols[11], acq_date: cols[5],
        acq_time: cols[6], satellite: cols[7], daynight: cols[12],
      });
    }

    if (colRows.length === 0) return 0;

    const mapped = colRows.map((r) => ({
      tipo: 'incendio' as const,
      intensidad: Number(r.frp) || Number(r.brightness),
      unidad: 'MW',
      fecha: new Date(`${r.acq_date}T${r.acq_time.padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2')}:00Z`).toISOString(),
      ubicacion: { type: 'Point' as const, coordinates: [Number(r.longitude), Number(r.latitude)] },
      fuente: `FIRMS-${r.satellite}`,
      datos_raw: r as unknown as Record<string, unknown>,
    }));

    return this.eventos.createMany(mapped);
  }

  async pollNow() { return this.poll(); }
}
