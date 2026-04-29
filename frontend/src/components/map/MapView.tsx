import 'ol/ol.css';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import HeatmapLayer from 'ol/layer/Heatmap';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { api } from '../../lib/api';
import { useMapStore } from '../../stores/map.store';
import type { EventoClimatico } from '../../types';

const NIVEL_FILL = { alto: 'rgba(229,57,53,0.3)', medio: 'rgba(249,168,37,0.25)', bajo: 'rgba(133,180,37,0.2)' } as const;
const NIVEL_STROKE = { alto: '#E53935', medio: '#F9A825', bajo: '#85B425' } as const;

function styleFor(feature: any) {
  const nivel = (feature.get('nivel_riesgo') as 'alto' | 'medio' | 'bajo') ?? 'bajo';
  return new Style({
    fill: new Fill({ color: NIVEL_FILL[nivel] ?? NIVEL_FILL.bajo }),
    stroke: new Stroke({ color: NIVEL_STROKE[nivel] ?? NIVEL_STROKE.bajo, width: 1.5 }),
  });
}

const eventoStyle = (tipo: string) => new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: tipo === 'lluvia' ? '#0069B4' : tipo === 'incendio' ? '#E53935' : '#F9A825' }),
    stroke: new Stroke({ color: '#fff', width: 1 }),
  }),
});

export function MapView() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const parquesRef = useRef<VectorLayer<VectorSource> | null>(null);
  const eventosRef = useRef<VectorLayer<VectorSource> | null>(null);
  const heatmapRef = useRef<HeatmapLayer | null>(null);
  const hotspotsRef = useRef<VectorLayer<VectorSource> | null>(null);
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({ base: true, parques: true, eventos: true, heatmap: false, hotspots: true });
  const [heatTipo, setHeatTipo] = useState<'incendio' | 'inundacion'>('incendio');
  const [heatOpacity, setHeatOpacity] = useState(75);
  const [selected, setSelected] = useState<{ nombre: string; region?: string; nivel?: string; frp?: number; confianza?: number; fuente?: string; fecha?: string } | null>(null);

  // Filtros de fecha para hotspots y eventos
  const [periodo, setPeriodo] = useState<'6' | '12' | '24' | '48' | '72' | '168' | 'custom'>('24');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const hotspotsParams = periodo === 'custom' && (desde || hasta)
    ? { desde: desde || undefined, hasta: hasta || undefined }
    : { hours: periodo };

  const eventosHours = periodo === 'custom'
    ? '168'
    : periodo;

  const parques = useQuery({
    queryKey: ['parques-geojson'],
    queryFn: async () => (await api.get('/parques/geojson')).data,
    staleTime: 5 * 60_000,
  });
  const eventos = useQuery<EventoClimatico[]>({
    queryKey: ['eventos-map', eventosHours],
    queryFn: async () => (await api.get('/eventos-climaticos', { params: { hours: eventosHours, limit: 2000 } })).data,
    refetchInterval: 60_000,
  });
  const heatmapQ = useQuery({
    queryKey: ['heatmap', heatTipo],
    queryFn: async () => (await api.get(`/predicciones/heatmap/${heatTipo}`)).data,
    enabled: layers.heatmap,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const iaHealth = useQuery({
    queryKey: ['ia-health'],
    queryFn: async () => (await api.get('/health', { baseURL: '/' })).data as { checks?: { ia: 'ok' | 'error' } },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const iaOk = iaHealth.data?.checks?.ia === 'ok';
  const hotspotsQ = useQuery({
    queryKey: ['hotspots-map', hotspotsParams],
    queryFn: async () => (await api.get('/hotspots', { params: hotspotsParams })).data,
    enabled: layers.hotspots,
    refetchInterval: 30 * 60_000,
  });

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    parquesRef.current = new VectorLayer({ source: new VectorSource(), style: styleFor, zIndex: 2 });
    eventosRef.current = new VectorLayer({ source: new VectorSource(), zIndex: 3 });
    hotspotsRef.current = new VectorLayer({
      source: new VectorSource(),
      zIndex: 5,
      style: (f) => {
        const conf = Number(f.get('confianza') ?? 50);
        const frp = Number(f.get('frp') ?? 1);
        const r = Math.min(11, 4 + frp / 12);
        const color = conf > 70 ? 'rgba(229,57,53,0.92)' : conf > 40 ? 'rgba(249,168,37,0.85)' : 'rgba(255,220,0,0.7)';
        return new Style({
          image: new CircleStyle({
            radius: r,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#fff', width: 1.5 }),
          }),
        });
      },
    });
    heatmapRef.current = new HeatmapLayer({
      source: new VectorSource(),
      blur: 28, radius: 20,
      weight: (f) => {
        const p = Number(f.get('probabilidad') ?? 0);
        return p <= 0 ? 0 : Math.min(1, 0.1 + p / 35);
      },
      gradient: ['#001f3f', '#003f7f', '#0074D9', '#FFDC00', '#FF851B', '#FF4136'],
      zIndex: 4, opacity: 0.75,
    });
    mapRef.current = new Map({
      target: mapEl.current,
      layers: [
        new TileLayer({
          // Tiles siempre se piden al mismo origen (/tiles/osm/...). Nginx actua como
          // proxy-cache hacia tile.openstreetmap.org. Beneficios:
          //  - El navegador no contacta a OSM directamente (CSP img-src 'self' estricta).
          //  - Una vez cacheado un tile, requests siguientes no van a internet.
          //  - Si mas adelante VITE_LOCAL_TILES=true y tileserver-gl tiene MBTiles, se puede
          //    volver a esa ruta con cero cambios en el server (solo rebuild).
          source: import.meta.env.VITE_LOCAL_TILES === 'true'
            ? new XYZ({ url: `${import.meta.env.VITE_TILES_URL ?? '/tiles'}/styles/basic-preview/{z}/{x}/{y}.png`, maxZoom: 14, attributions: '© OpenStreetMap · Manobi on-premise' })
            : new XYZ({ url: '/tiles/osm/{z}/{x}/{y}.png', maxZoom: 19, attributions: '© OpenStreetMap contributors · via Manobi Sentinel' }),
          zIndex: 0,
        }),
        parquesRef.current, eventosRef.current, heatmapRef.current, hotspotsRef.current!,
      ],
      view: new View({ center: fromLonLat([-73.5, 4.5]), zoom: 5.2 }),
    });
    mapRef.current.on('singleclick', (evt) => {
      let hit = false;
      mapRef.current!.forEachFeatureAtPixel(evt.pixel, (f) => {
        const p = (f as Feature).getProperties();
        if (p.frp != null) {
          setSelected({
            nombre: `Punto de calor (${p.fuente ?? 'OroraTech'})`,
            frp: p.frp,
            confianza: p.confianza,
            fuente: p.fuente,
            fecha: p.fecha,
            nivel: Number(p.confianza) > 70 ? 'alto' : 'medio',
          });
          hit = true; return true;
        }
        if (p.nombre) {
          setSelected({ nombre: p.nombre, region: p.region, nivel: p.nivel_riesgo });
          hit = true; return true;
        }
      });
      if (!hit) setSelected(null);
    });
    setReady(true);
    return () => { mapRef.current?.setTarget(undefined); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!ready || !parquesRef.current || !parques.data) return;
    const src = parquesRef.current.getSource()!;
    src.clear();
    const features = new GeoJSON().readFeatures(parques.data, { featureProjection: 'EPSG:3857' });
    src.addFeatures(features);
    if (features.length && mapRef.current) {
      const ext = src.getExtent();
      if (ext && isFinite(ext[0])) mapRef.current.getView().fit(ext, { padding: [40,40,40,40], maxZoom: 7, duration: 300 });
    }
  }, [ready, parques.data]);

  useEffect(() => {
    if (!ready || !eventosRef.current || !eventos.data) return;
    const src = eventosRef.current.getSource()!;
    src.clear();
    eventos.data.forEach((e) => {
      const coords = (e as unknown as { ubicacion?: { coordinates?: number[] } }).ubicacion?.coordinates;
      if (!coords) return;
      const f = new Feature({ geometry: new Point(fromLonLat(coords)) });
      f.setStyle(eventoStyle(e.tipo));
      src.addFeature(f);
    });
  }, [ready, eventos.data]);

  useEffect(() => {
    if (!ready || !heatmapRef.current || !heatmapQ.data) return;
    const src = heatmapRef.current.getSource()!;
    src.clear();
    src.addFeatures(new GeoJSON().readFeatures(heatmapQ.data, { featureProjection: 'EPSG:3857' }));
  }, [ready, heatmapQ.data]);

  useEffect(() => {
    if (!ready || !hotspotsRef.current || !hotspotsQ.data) return;
    const src = hotspotsRef.current.getSource();
    if (!src) return;
    src.clear();
    try { src.addFeatures(new GeoJSON().readFeatures(hotspotsQ.data, { featureProjection: 'EPSG:3857' })); }
    catch (e) { console.warn('[hotspots]', e); }
  }, [ready, hotspotsQ.data]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getLayers().item(0)?.setVisible(layers.base);
    parquesRef.current?.setVisible(layers.parques);
    eventosRef.current?.setVisible(layers.eventos);
    heatmapRef.current?.setVisible(layers.heatmap);
    hotspotsRef.current?.setVisible(layers.hotspots);
  }, [layers]);

  useEffect(() => {
    heatmapRef.current?.setOpacity(heatOpacity / 100);
  }, [heatOpacity]);

  // Focus en parque desde AlertsPanel
  const focusParqueId = useMapStore((s) => s.focusParqueId);
  const focusTs = useMapStore((s) => s.focusTs);
  useEffect(() => {
    if (!focusParqueId || !ready || !parquesRef.current || !mapRef.current) return;
    const src = parquesRef.current.getSource();
    if (!src) return;
    const feature = src.getFeatures().find((f) => f.getId() === focusParqueId);
    if (feature) {
      const ext = feature.getGeometry()?.getExtent();
      if (ext && isFinite(ext[0])) {
        mapRef.current.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 10, duration: 600 });
        const props = feature.getProperties();
        setSelected({ nombre: props.nombre, region: props.region, nivel: props.nivel_riesgo });
      }
    }
  }, [focusParqueId, focusTs, ready]);

  return (
    <div className="panel relative overflow-hidden h-full w-full min-h-[400px]">
      <div ref={mapEl} className="absolute inset-0 bg-[#0a0e1a]" />

      <div className="absolute top-2 right-2 md:top-3 md:right-3 panel p-2.5 text-xs space-y-1.5 z-10 min-w-[150px] md:min-w-[180px]">
        <div className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider mb-1">Capas</div>
        {(['base', 'parques', 'eventos', 'heatmap', 'hotspots'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer py-0.5">
            <input type="checkbox" className="h-4 w-4 md:h-3.5 md:w-3.5" checked={layers[k]} onChange={(e) => setLayers((s) => ({ ...s, [k]: e.target.checked }))} />
            <span className="capitalize text-xs text-txt">
              {k === 'heatmap' ? 'Heatmap IA' : k === 'hotspots' ? 'Puntos de calor' : k}
            </span>
            {k === 'heatmap' && (
              <span
                className={`ml-auto text-[9px] font-mono px-1 rounded ${iaOk ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}`}
                title={iaOk ? 'Servicio IA disponible' : 'IA no disponible — datos vacíos'}>
                {iaOk ? 'OK' : 'OFF'}
              </span>
            )}
          </label>
        ))}
        {layers.heatmap && (
          <div className="space-y-1.5 pt-1 border-t border-border-subtle">
            <select value={heatTipo} onChange={(e) => setHeatTipo(e.target.value as 'incendio' | 'inundacion')}
              title="Tipo de heatmap IA" aria-label="Tipo de heatmap IA"
              className="input-field !py-1 text-xs w-full">
              <option value="incendio">🔥 Incendio</option>
              <option value="inundacion">🌊 Inundación</option>
            </select>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-txt-muted shrink-0">Opacidad</span>
              <input type="range" min="10" max="100" value={heatOpacity}
                title="Opacidad del heatmap IA" aria-label="Opacidad del heatmap IA"
                onChange={(e) => setHeatOpacity(Number(e.target.value))}
                className="flex-1 h-1 accent-pnn-blue" />
              <span className="text-[10px] font-mono text-txt-muted w-6 text-right">{heatOpacity}%</span>
            </div>
            {heatmapQ.isFetching && <div className="text-[10px] text-txt-muted animate-pulse">Cargando IA…</div>}
            {heatmapQ.data && (
              <div className="text-[10px] text-txt-muted">
                {heatmapQ.data.features?.length ?? 0} puntos
                {heatmapQ.dataUpdatedAt ? ` · ${new Date(heatmapQ.dataUpdatedAt).toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })}` : ''}
              </div>
            )}
            {!iaOk && !heatmapQ.isFetching && (
              <div className="text-[10px] text-accent-red/80">IA no disponible. Se muestra vacío.</div>
            )}
          </div>
        )}
      </div>

      {/* Panel de filtro de fechas — bottom-left */}
      <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 panel p-2.5 z-10 space-y-1.5 min-w-[200px] md:min-w-[240px]">
        <div className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider">Período</div>
        <div className="flex flex-wrap gap-1">
          {(['6','12','24','48','72','168'] as const).map((h) => (
            <button key={h} type="button"
              onClick={() => { setPeriodo(h); setDesde(''); setHasta(''); }}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition ${
                periodo === h
                  ? 'bg-pnn-blue/20 border-pnn-blue text-pnn-blue'
                  : 'border-border-subtle text-txt-muted hover:border-pnn-blue/50 hover:text-txt'
              }`}>
              {h === '168' ? '7d' : `${h}h`}
            </button>
          ))}
          <button type="button"
            onClick={() => setPeriodo('custom')}
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition ${
              periodo === 'custom'
                ? 'bg-pnn-blue/20 border-pnn-blue text-pnn-blue'
                : 'border-border-subtle text-txt-muted hover:border-pnn-blue/50 hover:text-txt'
            }`}>
            personalizado
          </button>
        </div>
        {periodo === 'custom' && (
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-txt-muted w-10 shrink-0">Desde</span>
              <input type="datetime-local" value={desde} title="Fecha inicio" aria-label="Fecha inicio"
                onChange={(e) => setDesde(e.target.value)}
                className="flex-1 bg-bg-surface2 border border-border-subtle rounded px-1.5 py-0.5 text-[10px] font-mono text-txt" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-txt-muted w-10 shrink-0">Hasta</span>
              <input type="datetime-local" value={hasta} title="Fecha fin" aria-label="Fecha fin"
                onChange={(e) => setHasta(e.target.value)}
                className="flex-1 bg-bg-surface2 border border-border-subtle rounded px-1.5 py-0.5 text-[10px] font-mono text-txt" />
            </div>
          </div>
        )}
        <div className="text-[9px] text-txt-muted font-mono">
          {hotspotsQ.data?.features?.length ?? 0} puntos · {eventos.data?.length ?? 0} eventos
        </div>
      </div>

      <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 panel p-2 text-[10px] font-mono z-10 hidden md:block">
        <div className="text-white/50 mb-1">NIVEL DE RIESGO</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{background:NIVEL_FILL.alto, border:`1px solid ${NIVEL_STROKE.alto}`}}/>Alto</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{background:NIVEL_FILL.medio, border:`1px solid ${NIVEL_STROKE.medio}`}}/>Medio</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{background:NIVEL_FILL.bajo, border:`1px solid ${NIVEL_STROKE.bajo}`}}/>Bajo</div>
      </div>

      {selected && (
        <div className="absolute top-2 left-2 md:top-3 md:left-3 panel p-3 max-w-[85vw] md:max-w-xs z-10 space-y-1">
          <button type="button" onClick={() => setSelected(null)} className="absolute top-1.5 right-2 text-txt-light hover:text-txt text-lg touch-target">×</button>
          <div className="text-sm font-semibold text-txt">{selected.nombre}</div>
          {selected.region && <div className="text-xs text-txt-muted">{selected.region}</div>}
          {selected.nivel && <div className="text-xs mt-1">
            <span className={`chip chip-${selected.nivel === 'alto' ? 'rojo' : selected.nivel === 'medio' ? 'amarillo' : 'verde'}`}>
              {selected.nivel}
            </span>
          </div>}
          {selected.frp != null && (
            <div className="text-xs text-txt-muted space-y-0.5 mt-2 border-t border-border-subtle pt-2">
              <div>FRP: <b className="text-txt">{selected.frp} MW</b></div>
              <div>Confianza: <b className="text-txt">{selected.confianza}%</b></div>
              <div>Fuente: {selected.fuente}</div>
              {selected.fecha && <div>{new Date(selected.fecha as string).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>}
            </div>
          )}
          <button type="button" onClick={() => {
            setSelected(null);
            useMapStore.getState().clearFocus();
            mapRef.current?.getView().animate({ center: fromLonLat([-73.5, 4.5]), zoom: 5.2, duration: 500 });
          }} className="btn-outline w-full mt-2 !py-1.5 !text-xs touch-target">
            ← Vista general
          </button>
        </div>
      )}
    </div>
  );
}
