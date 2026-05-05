import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import { firstValueFrom } from 'rxjs';

export interface BurntAreaFeature {
  id: string | number;
  area_ha: number;
  start_time: string;
  end_time: string | null;
  satellite: string;
  confidence: number | null;
  parque_id: string | null;
  parque_nombre: string | null;
  geometry: unknown;
}

interface OroraBurntFeature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}
interface OroraBurntGeoJSON {
  type: string;
  features: OroraBurntFeature[];
}

// In-memory cache: key → { data, expires }
const cache = new Map<string, { data: BurntAreaFeature[]; expires: number }>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

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

    try {
      const { data } = await firstValueFrom(this.http.get<OroraBurntGeoJSON>(
        `${this.baseUrl}/burnt_areas/`,
        {
          timeout: 30_000,
          params: { xmin: -79, ymin: -4, xmax: -67, ymax: 13, start_time: desde, end_time: hasta },
          headers: { apikey: this.apiKey },
        },
      ));

      const raw = data?.features ?? [];
      this.log.log(`OroraTech burnt_areas: ${raw.length} polígonos [${desde} → ${hasta}]`);

      if (raw.length === 0) return [];

      return await this.enrichWithParques(raw);
    } catch (e) {
      this.log.error(`Error OroraTech burnt_areas: ${(e as Error).message}`);
      return [];
    }
  }

  private async enrichWithParques(raw: OroraBurntFeature[]): Promise<BurntAreaFeature[]> {
    const result: BurntAreaFeature[] = [];

    for (const f of raw) {
      const p = f.properties;
      const areaHa = Number(p.area_ha ?? p.area ?? 0);
      const startTime = String(p.start_time ?? p.detection_time ?? p.acquisition_time ?? '');
      const endTime = p.end_time ? String(p.end_time) : null;
      const satellite = String(p.satellite_name ?? p.satellite ?? 'OroraTech');
      const confidence = p.confidence != null ? Number(p.confidence) : null;
      const id = String(p.id ?? Math.random().toString(36).slice(2));

      let parqueId: string | null = null;
      let parqueNombre: string | null = null;

      // Spatial join: buscar parque que intersecta con la geometría
      if (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon') {
        try {
          const rows = await this.ds.query<{ id: string; nombre: string }[]>(
            `SELECT p.id, p.nombre
             FROM parques p
             WHERE ST_Intersects(p.geometria, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
             LIMIT 1`,
            [JSON.stringify(f.geometry)],
          );
          if (rows.length > 0) {
            parqueId = rows[0].id;
            parqueNombre = rows[0].nombre;
          }
        } catch { /* geometría inválida, se deja null */ }
      }

      result.push({ id, area_ha: areaHa, start_time: startTime, end_time: endTime, satellite, confidence, parque_id: parqueId, parque_nombre: parqueNombre, geometry: f.geometry });
    }

    return result;
  }

  summarize(features: BurntAreaFeature[]) {
    const totalHa = features.reduce((s, f) => s + f.area_ha, 0);
    const porParque = new Map<string, { nombre: string; ha: number; count: number }>();

    features.forEach((f) => {
      const key = f.parque_id ?? '__fuera__';
      const nombre = f.parque_nombre ?? 'Fuera de área protegida';
      const cur = porParque.get(key) ?? { nombre, ha: 0, count: 0 };
      cur.ha += f.area_ha;
      cur.count++;
      porParque.set(key, cur);
    });

    const topParques = [...porParque.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.ha - a.ha)
      .slice(0, 10);

    return {
      total_ha: Math.round(totalHa * 100) / 100,
      count: features.length,
      parques_afectados: [...porParque.keys()].filter((k) => k !== '__fuera__').length,
      top_parques: topParques,
      features,
    };
  }
}
