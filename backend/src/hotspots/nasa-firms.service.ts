import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { HotspotData, HotspotProvider } from './hotspot.interface';

const COL_BBOX = { minLon: -79.5, maxLon: -66.8, minLat: -4.2, maxLat: 13.5 };

const OPEN_CSVS = [
  { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_America_24h.csv', sat: 'Suomi-NPP' },
  { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_24h.csv', sat: 'NOAA-20' },
  { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_America_24h.csv', sat: 'MODIS' },
];

@Injectable()
export class NasaFirmsService implements HotspotProvider {
  readonly nombre = 'NASA_FIRMS';
  private readonly log = new Logger('NasaFIRMS');
  private readonly apiKey: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly http: HttpService,
  ) {
    this.apiKey = cfg.get<string>('NASA_FIRMS_API_KEY') ?? '';
  }

  async poll(): Promise<HotspotData[]> {
    const all: HotspotData[] = [];

    if (this.apiKey) {
      for (const sensor of ['VIIRS_SNPP_NRT', 'MODIS_NRT']) {
        try {
          const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${this.apiKey}/${sensor}/-79,-4,-67,13/1`;
          all.push(...await this.parseCsv(url, sensor));
        } catch { /* fallback below */ }
      }
    }

    if (all.length === 0) {
      for (const src of OPEN_CSVS) {
        try { all.push(...await this.parseCsv(src.url, src.sat)); }
        catch (e) { this.log.warn(`${src.sat}: ${(e as Error).message}`); }
      }
    }

    this.log.log(`Total: ${all.length} hotspots Colombia`);
    return all;
  }

  private async parseCsv(url: string, sat: string): Promise<HotspotData[]> {
    const { data: csv } = await firstValueFrom(
      this.http.get<string>(url, { timeout: 30_000, responseType: 'text' as never }),
    );
    const lines = (csv as string).split('\n');
    const header = lines[0]?.split(',') ?? [];
    const idx = (name: string) => header.indexOf(name);

    const iLat = idx('latitude');
    const iLon = idx('longitude');
    const iFrp = idx('frp');
    const iConf = idx('confidence');
    const iDate = idx('acq_date');
    const iTime = idx('acq_time');
    const iBright = idx('brightness');
    const iSat = idx('satellite');

    const results: HotspotData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]?.split(',');
      if (!cols || cols.length < 6) continue;

      const lat = Number(cols[iLat]);
      const lon = Number(cols[iLon]);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      if (lat < COL_BBOX.minLat || lat > COL_BBOX.maxLat) continue;
      if (lon < COL_BBOX.minLon || lon > COL_BBOX.maxLon) continue;

      const frp = Number(cols[iFrp]) || Number(cols[iBright]) || 0;
      let conf = Number(cols[iConf]);
      if (cols[iConf] === 'l') conf = 30;
      else if (cols[iConf] === 'n') conf = 50;
      else if (cols[iConf] === 'h') conf = 90;

      const time = (cols[iTime] ?? '0000').padStart(4, '0');
      const fecha = new Date(`${cols[iDate]}T${time.slice(0, 2)}:${time.slice(2)}:00Z`);

      results.push({
        latitud: lat,
        longitud: lon,
        intensidad_frp: Math.round(frp * 100) / 100,
        confianza: conf,
        fecha,
        fuente: 'NASA_FIRMS',
        satelite: cols[iSat] ?? sat,
        datos_raw: Object.fromEntries(header.map((h, j) => [h, cols[j]])),
      });
    }
    return results;
  }
}
