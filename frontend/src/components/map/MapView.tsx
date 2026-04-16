import 'ol/ol.css';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import HeatmapLayer from 'ol/layer/Heatmap';
import OSM from 'ol/source/OSM';
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

const NIVEL_FILL = { alto: 'rgba(255,59,59,0.45)', medio: 'rgba(255,176,32,0.35)', bajo: 'rgba(0,255,136,0.25)' } as const;
const NIVEL_STROKE = { alto: '#ff3b3b', medio: '#ffb020', bajo: '#00ff88' } as const;

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
    fill: new Fill({ color: tipo === 'lluvia' ? '#00bfff' : tipo === 'incendio' ? '#ff3b3b' : '#ffb020' }),
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
  const [selected, setSelected] = useState<{ nombre: string; region?: string; nivel?: string; frp?: number; confianza?: number; fuente?: string; fecha?: string } | null>(null);

  const parques = useQuery({
    queryKey: ['parques-geojson'],
    queryFn: async () => (await api.get('/parques/geojson')).data,
    staleTime: 5 * 60_000,
  });
  const eventos = useQuery<EventoClimatico[]>({
    queryKey: ['eventos-map'],
    queryFn: async () => (await api.get('/eventos-climaticos?hours=24')).data,
    refetchInterval: 60_000,
  });
  const heatmapQ = useQuery({
    queryKey: ['heatmap', heatTipo],
    queryFn: async () => (await api.get(`/predicciones/heatmap/${heatTipo}`)).data,
    enabled: layers.heatmap,
    refetchInterval: 5 * 60_000,
  });
  const hotspotsQ = useQuery({
    queryKey: ['hotspots-map'],
    queryFn: async () => (await api.get('/hotspots?hours=24')).data,
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
        const r = Math.min(12, 4 + frp / 10);
        const color = conf > 70 ? 'rgba(255,59,59,0.9)' : conf > 40 ? 'rgba(255,176,32,0.8)' : 'rgba(255,220,0,0.6)';
        return new Style({ image: new CircleStyle({ radius: r, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 1 }) }) });
      },
    });
    heatmapRef.current = new HeatmapLayer({
      source: new VectorSource(),
      blur: 30, radius: 22,
      weight: (f) => {
        const p = Number(f.get('probabilidad') ?? 0);
        return p <= 0 ? 0 : Math.min(1, 0.15 + p / 40);
      },
      gradient: ['#001f3f', '#0074D9', '#FFDC00', '#FF851B', '#FF4136'],
      zIndex: 4, opacity: 0.75,
    });
    mapRef.current = new Map({
      target: mapEl.current,
      layers: [
        new TileLayer({
          source: import.meta.env.VITE_LOCAL_TILES === 'true'
            ? new XYZ({ url: `${import.meta.env.VITE_TILES_URL ?? '/tiles'}/styles/basic-preview/{z}/{x}/{y}.png`, maxZoom: 14, attributions: '© OpenStreetMap · Manobi on-premise' })
            : new OSM(),
          zIndex: 0,
        }),
        parquesRef.current, eventosRef.current, heatmapRef.current, hotspotsRef.current!,
      ],
      view: new View({ center: fromLonLat([-73.5, 4.5]), zoom: 5.2 }),
    });
    mapRef.current.on('singleclick', (evt) => {
      let hit = false;
      mapRef.current!.forEachFeatureAtPixel(evt.pixel, (f) => {
        const p = f.getProperties();
        if (p.frp != null) {
          setSelected({ nombre: `Punto de calor (${p.fuente})`, frp: p.frp, confianza: p.confianza, fuente: p.fuente, fecha: p.fecha, nivel: p.confianza > 70 ? 'alto' : 'medio' });
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
    const src = hotspotsRef.current.getSource()!;
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

      <div className="absolute top-2 right-2 md:top-3 md:right-3 panel p-2 md:p-2 text-xs space-y-1.5 z-10 min-w-[140px] md:min-w-[160px]">
        <div className="text-[10px] font-mono text-white/50 mb-1">CAPAS</div>
        {(['base', 'parques', 'eventos', 'heatmap', 'hotspots'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer py-0.5">
            <input type="checkbox" className="h-4 w-4 md:h-3.5 md:w-3.5" checked={layers[k]} onChange={(e) => setLayers((s) => ({ ...s, [k]: e.target.checked }))} />
            <span className="capitalize text-xs">{k === 'heatmap' ? 'Heatmap IA' : k === 'hotspots' ? 'Puntos de calor' : k}</span>
          </label>
        ))}
        {layers.heatmap && (
          <select value={heatTipo} onChange={(e) => setHeatTipo(e.target.value as 'incendio' | 'inundacion')}
            title="Tipo de heatmap IA" aria-label="Tipo de heatmap IA"
            className="w-full mt-1 bg-bg-surface2 border border-border-subtle rounded px-2 py-1.5 text-xs font-mono">
            <option value="incendio">Incendio</option>
            <option value="inundacion">Inundación</option>
          </select>
        )}
      </div>

      <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 panel p-2 text-[10px] font-mono z-10 hidden md:block">
        <div className="text-white/50 mb-1">NIVEL DE RIESGO</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{background:NIVEL_FILL.alto, border:`1px solid ${NIVEL_STROKE.alto}`}}/>Alto</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{background:NIVEL_FILL.medio, border:`1px solid ${NIVEL_STROKE.medio}`}}/>Medio</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{background:NIVEL_FILL.bajo, border:`1px solid ${NIVEL_STROKE.bajo}`}}/>Bajo</div>
      </div>

      {selected && (
        <div className="absolute top-2 left-2 md:top-3 md:left-3 panel p-3 max-w-[85vw] md:max-w-xs z-10 space-y-1">
          <button type="button" onClick={() => setSelected(null)} className="absolute top-1 right-2 text-white/50 hover:text-white text-lg touch-target">×</button>
          <div className="text-sm font-bold">{selected.nombre}</div>
          {selected.region && <div className="text-xs text-white/60">Región: {selected.region}</div>}
          {selected.nivel && <div className="text-xs">Nivel: <span className={`chip chip-${selected.nivel === 'alto' ? 'rojo' : selected.nivel === 'medio' ? 'amarillo' : 'verde'}`}>{selected.nivel}</span></div>}
          {selected.frp != null && (
            <div className="text-xs font-mono text-white/70 space-y-0.5 mt-1 border-t border-border-subtle pt-1">
              <div>FRP: <b>{selected.frp} MW</b></div>
              <div>Confianza: <b>{selected.confianza}%</b></div>
              <div>Fuente: {selected.fuente}</div>
              {selected.fecha && <div>Fecha: {new Date(selected.fecha as string).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
