import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { HotspotData, HotspotProvider } from './hotspot.interface';

/**
 * OroraTech Wildfire Intelligence API — preparado pero inactivo.
 *
 * Para activar:
 *   1. Solicitar API key en https://www.ororatech.com/contact
 *   2. En .env: ORORATECH_ENABLED=true y ORORATECH_API_KEY=<key>
 *   3. Reconstruir: docker compose up -d --build api
 *
 * La API devuelve detecciones térmicas satelitales con resolución ~375m.
 * Misma interfaz HotspotData que NASA FIRMS para intercambio transparente.
 */
@Injectable()
export class OroraTechService implements HotspotProvider {
  readonly nombre = 'ORORATECH';
  private readonly log = new Logger('OroraTech');
  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://app.ororatech.com/v1';

  constructor(
    private readonly cfg: ConfigService,
    private readonly http: HttpService,
  ) {
    this.enabled = cfg.get<string>('ORORATECH_ENABLED') === 'true';
    this.apiKey = cfg.get<string>('ORORATECH_API_KEY') ?? '';
  }

  async poll(): Promise<HotspotData[]> {
    if (!this.enabled || !this.apiKey) return [];

    try {
      const { data } = await firstValueFrom(this.http.get<OroraGeoJSON>(
        `${this.baseUrl}/hotspots/`, {
          timeout: 30_000,
          params: {
            xmin: -79, ymin: -4, xmax: -67, ymax: 13,
            minutes: 1440,
          },
          headers: { apikey: this.apiKey },
        },
      ));

      const features = data?.features ?? [];
      this.log.log(`OroraTech: ${features.length} hotspots Colombia`);

      return features.map((f) => ({
        latitud: f.geometry.coordinates[1],
        longitud: f.geometry.coordinates[0],
        intensidad_frp: f.properties.frp ?? 0,
        confianza: 75,
        fecha: new Date(f.properties.acquisition_time),
        fuente: 'ORORATECH' as const,
        satelite: f.properties.satellite_name ?? 'OroraTech',
        datos_raw: f.properties as unknown as Record<string, unknown>,
      }));
    } catch (e) {
      this.log.warn(`OroraTech falló: ${(e as Error).message}`);
      return [];
    }
  }
}

interface OroraFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    acquisition_time: string;
    frp?: number;
    satellite_name?: string;
    satellite_orbit_type?: string;
    id?: number;
    gsd?: number;
  };
}
interface OroraGeoJSON { type: string; features: OroraFeature[]; }
