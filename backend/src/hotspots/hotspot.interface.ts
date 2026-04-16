export interface HotspotData {
  latitud: number;
  longitud: number;
  intensidad_frp: number;
  confianza: number;
  fecha: Date;
  fuente: 'NASA_FIRMS' | 'ORORATECH';
  satelite: string;
  datos_raw?: Record<string, unknown>;
}

export interface HotspotProvider {
  readonly nombre: string;
  poll(): Promise<HotspotData[]>;
}
