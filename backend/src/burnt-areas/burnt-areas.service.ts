import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import { firstValueFrom } from 'rxjs';

export interface BurntAreaFeature {
  id: number;
  area_ha: number;
  pre_time: string;
  post_time: string;
  severity: string;
  confidence: number; // 0-100
  product_type: string;
  mean_dnbr: number;
  parque_id: string | null;
  parque_nombre: string | null;
}

interface OroraBurntProps {
  id: number;
  area: number;              // in ha cuando unit_area=ha
  pre_time: string;
  post_time: string;
  severity: string;
  confidence: number;        // 0-1
  product_type: string;
  mean_dnbr: number;
  mean_dndvi: number;
  detection_processing_step_id: number;
}

interface OroraBurntFeature {
  type: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: OroraBurntProps;
}
interface OroraBurntGeoJSON { type: string; features: OroraBurntFeature[] }

// Formato date para OroraTech: 'YYYY-MM-DD-hhmm'
function toOroraDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${hh}${min}`;
}

const cache = new Map<string, { data: BurntAreaFeature[]; expires: number }>();
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_MINUTES = 180 * 24 * 60; // 180 días máximo por petición

@Injectable()
export class BurntAreasService {
  private readonly log = new Logger('BurntAreas');
  private readonly apiKey: string;
  private readonly baseUrl = 'https://app.ororatech.com/v1';

  constructor(
    private readonly cfg: ConfigService,
    private readonly http: HttpService,
    private readonly ds: DataSource,
  ) {
    this.apiKey = cfg.get<string>('ORORATECH_API_KEY') ?? '';
  }

  async findByRange(desde: string, hasta: string): Promise<BurntAreaFeature[]> {
    const cacheKey = `${desde}|${hasta}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    const features = await this.fetchFromOrora(desde, hasta);
    cache.set(cacheKey, { data: features, expires: Date.now() + TTL_MS });
    return features;
  }

  private async fetchFromOrora(desde: string, hasta: string): Promise<BurntAreaFeature[]> {
    if (!this.apiKey) { this.log.warn('ORORATECH_API_KEY no configurado'); return []; }

    const desdeMs = new Date(desde).getTime();
    const hastaMs = new Date(hasta).getTime();
    const minutes = Math.min(Math.ceil((hastaMs - desdeMs) / 60_000), MAX_MINUTES);
    const date = toOroraDate(hasta);

    try {
      const { data } = await firstValueFrom(this.http.get<OroraBurntGeoJSON>(
        `${this.baseUrl}/burnt_areas/`,
        {
          timeout: 60_000,
          params: {
            xmin: -79, ymin: -4, xmax: -67, ymax: 13,
            minutes,
            date,
            unit_area: 'ha',
            select: 'shape',
          },
          headers: { apikey: this.apiKey },
        },
      ));

      const raw = data?.features ?? [];
      this.log.log(`OroraTech burnt_areas: ${raw.length} polígonos [${date} - ${minutes}min]`);
      if (raw.length === 0) return [];

      return await this.enrichWithParques(raw);
    } catch (e) {
      this.log.error(`Error OroraTech burnt_areas: ${(e as Error).message}`);
      return [];
    }
  }

  private async enrichWithParques(raw: OroraBurntFeature[]): Promise<BurntAreaFeature[]> {
    const result: BurntAreaFeature[] = [];

    // Procesar en batches para no saturar PostgreSQL con 7k consultas
    const BATCH = 50;
    for (let i = 0; i < raw.length; i += BATCH) {
      const batch = raw.slice(i, i + BATCH);
      await Promise.all(batch.map(async (f) => {
        const p = f.properties;
        let parqueId: string | null = null;
        let parqueNombre: string | null = null;

        if (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon') {
          try {
            const rows = await this.ds.query<{ id: string; nombre: string }[]>(
              `SELECT p.id, p.nombre
               FROM parques p
               WHERE p.geometria IS NOT NULL
                 AND ST_Intersects(p.geometria, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
               LIMIT 1`,
              [JSON.stringify(f.geometry)],
            );
            if (rows.length > 0) { parqueId = rows[0].id; parqueNombre = rows[0].nombre; }
          } catch { /* geometría inválida */ }
        }

        result.push({
          id: p.id,
          area_ha: Math.round(p.area * 100) / 100,
          pre_time: p.pre_time,
          post_time: p.post_time,
          severity: p.severity ?? 'unknown',
          confidence: Math.round(p.confidence * 100),
          product_type: p.product_type ?? 'unknown',
          mean_dnbr: Math.round(p.mean_dnbr * 10000) / 10000,
          parque_id: parqueId,
          parque_nombre: parqueNombre,
        });
      }));
    }

    return result;
  }

  summarize(features: BurntAreaFeature[]) {
    const totalHa = features.reduce((s, f) => s + f.area_ha, 0);
    const porParque = new Map<string, { nombre: string; ha: number; count: number }>();
    const porSeveridad: Record<string, number> = {};

    features.forEach((f) => {
      const key = f.parque_id ?? '__fuera__';
      const nombre = f.parque_nombre ?? 'Fuera de área protegida';
      const cur = porParque.get(key) ?? { nombre, ha: 0, count: 0 };
      cur.ha += f.area_ha;
      cur.count++;
      porParque.set(key, cur);

      porSeveridad[f.severity] = (porSeveridad[f.severity] ?? 0) + 1;
    });

    return {
      total_ha: Math.round(totalHa * 100) / 100,
      count: features.length,
      parques_afectados: [...porParque.keys()].filter((k) => k !== '__fuera__').length,
      por_severidad: porSeveridad,
      top_parques: [...porParque.entries()]
        .map(([id, v]) => ({ id, ...v, ha: Math.round(v.ha * 100) / 100 }))
        .sort((a, b) => b.ha - a.ha)
        .slice(0, 10),
      features,
    };
  }
}
