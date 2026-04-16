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
  private readonly baseUrl = 'https://api.ororatech.com/v1';

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
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data } = await firstValueFrom(this.http.get<OroraResponse>(
        `${this.baseUrl}/detections`, {
          timeout: 30_000,
          params: {
            bbox: '-79,-4,-67,13',
            since,
            confidence_min: 30,
          },
          headers: { Authorization: `Bearer ${this.apiKey}` },
        },
      ));

      return (data.detections ?? []).map((d) => ({
        latitud: d.latitude,
        longitud: d.longitude,
        intensidad_frp: d.frp ?? 0,
        confianza: d.confidence ?? 50,
        fecha: new Date(d.timestamp),
        fuente: 'ORORATECH' as const,
        satelite: d.satellite ?? 'OroraTech',
        datos_raw: d as unknown as Record<string, unknown>,
      }));
    } catch (e) {
      this.log.warn(`OroraTech falló: ${(e as Error).message}`);
      return [];
    }
  }
}

interface OroraDetection {
  latitude: number; longitude: number; frp?: number;
  confidence?: number; timestamp: string; satellite?: string;
}
interface OroraResponse { detections?: OroraDetection[]; }
