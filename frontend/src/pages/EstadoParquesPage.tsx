import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import { useMapStore } from '../stores/map.store';
import type { Alerta, Parque } from '../types';

interface Prediccion {
  id: string;
  tipo: 'incendio' | 'inundacion';
  probabilidad: string;
  parque_id: string;
  fecha: string;
}

interface ContextoParque {
  id: string;
  lluvia_24h_mm: string | null;
  lluvia_1h_mm: string | null;
  temperatura_c: string | null;
  humedad_relativa: string | null;
  viento_kmh: string | null;
  nivel_rio_mt: string | null;
  updated_at: string | null;
}

type EstadoAlerta = 'rojo' | 'amarillo' | 'verde' | 'sin_alertas';

const ESTADO_ORDER: Record<EstadoAlerta, number> = { rojo: 0, amarillo: 1, verde: 2, sin_alertas: 3 };
const NIVEL_RIESGO_ORDER = { alto: 0, medio: 1, bajo: 2, null: 3 } as Record<string, number>;

function nivelActivo(alertas: Alerta[]): EstadoAlerta {
  if (alertas.some((a) => a.nivel === 'rojo')) return 'rojo';
  if (alertas.some((a) => a.nivel === 'amarillo')) return 'amarillo';
  if (alertas.some((a) => a.nivel === 'verde')) return 'verde';
  return 'sin_alertas';
}

function estadoBg(estado: EstadoAlerta) {
  return {
    rojo:        'border-accent-red/60 bg-accent-red/5',
    amarillo:    'border-amber-500/60 bg-amber-500/5',
    verde:       'border-accent-green/60 bg-accent-green/5',
    sin_alertas: 'border-border-subtle bg-bg-surface',
  }[estado];
}

function estadoDot(estado: EstadoAlerta) {
  return {
    rojo:        'bg-accent-red animate-pulse',
    amarillo:    'bg-amber-500 animate-pulse',
    verde:       'bg-accent-green',
    sin_alertas: 'bg-txt-muted',
  }[estado];
}

function estadoLabel(estado: EstadoAlerta) {
  return {
    rojo:        'ALERTA ROJA',
    amarillo:    'ALERTA AMARILLA',
    verde:       'ALERTA VERDE',
    sin_alertas: 'Sin alertas',
  }[estado];
}

function estadoTextColor(estado: EstadoAlerta) {
  return {
    rojo:        'text-accent-red',
    amarillo:    'text-amber-400',
    verde:       'text-accent-green',
    sin_alertas: 'text-txt-muted',
  }[estado];
}

function probColor(p: number) {
  if (p >= 70) return 'text-accent-red';
  if (p >= 40) return 'text-amber-400';
  return 'text-txt-muted';
}

function riesgoBadge(nivel: string | null) {
  if (!nivel) return null;
  const cls = nivel === 'alto' ? 'chip-rojo' : nivel === 'medio' ? 'chip-amarillo' : 'chip-verde';
  return <span className={`chip ${cls}`}>{nivel}</span>;
}

function minutesAgo(iso: string | null): string {
  if (!iso) return 'sin datos';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}min`;
  return `hace ${Math.floor(mins / 60)}h`;
}

export function EstadoParquesPage() {
  const navigate = useNavigate();
  const [filtroEstado, setFiltroEstado] = useState<EstadoAlerta | ''>('');
  const [filtroRegion, setFiltroRegion] = useState('');
  const [orden, setOrden] = useState<'estado' | 'nombre' | 'riesgo'>('estado');
  const [busqueda, setBusqueda] = useState('');

  const parques = useQuery<Parque[]>({
    queryKey: ['parques-list'],
    queryFn: async () => (await api.get('/parques')).data,
    staleTime: 2 * 60_000,
  });

  const alertas = useQuery<Alerta[]>({
    queryKey: ['alertas-activas'],
    queryFn: async () => (await api.get('/alertas')).data,
    refetchInterval: 15_000,
  });

  const preds = useQuery<Prediccion[]>({
    queryKey: ['predicciones-latest'],
    queryFn: async () => (await api.get('/predicciones/latest')).data,
    refetchInterval: 60_000,
  });

  const contextos = useQuery<ContextoParque[]>({
    queryKey: ['parques-contexto'],
    queryFn: async () => (await api.get('/parques/contexto-resumen')).data,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const alertasPorParque = useMemo(() => {
    const m = new Map<string, Alerta[]>();
    alertas.data?.forEach((a) => {
      if (!a.parque_id) return;
      m.set(a.parque_id, [...(m.get(a.parque_id) ?? []), a]);
    });
    return m;
  }, [alertas.data]);

  const predsPorParque = useMemo(() => {
    const m = new Map<string, Prediccion[]>();
    preds.data?.forEach((p) => {
      m.set(p.parque_id, [...(m.get(p.parque_id) ?? []), p]);
    });
    return m;
  }, [preds.data]);

  const contextoPorParque = useMemo(() => {
    const m = new Map<string, ContextoParque>();
    contextos.data?.forEach((c) => m.set(c.id, c));
    return m;
  }, [contextos.data]);

  const regiones = useMemo(() =>
    Array.from(new Set(parques.data?.map((p) => p.region ?? '').filter(Boolean))).sort(),
    [parques.data],
  );

  const parquesConEstado = useMemo(() => {
    return (parques.data ?? []).map((p) => {
      const aps = alertasPorParque.get(p.id) ?? [];
      const estado = nivelActivo(aps);
      const predsP = predsPorParque.get(p.id) ?? [];
      const incendio = predsP.find((x) => x.tipo === 'incendio');
      const inundacion = predsP.find((x) => x.tipo === 'inundacion');
      const ctx = contextoPorParque.get(p.id) ?? null;
      return { ...p, estado, alertas: aps, incendio, inundacion, ctx };
    });
  }, [parques.data, alertasPorParque, predsPorParque, contextoPorParque]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return parquesConEstado
      .filter((p) => !filtroEstado || p.estado === filtroEstado)
      .filter((p) => !filtroRegion || (p.region ?? '') === filtroRegion)
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .sort((a, b) => {
        if (orden === 'estado') return ESTADO_ORDER[a.estado] - ESTADO_ORDER[b.estado];
        if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
        if (orden === 'riesgo') return (NIVEL_RIESGO_ORDER[a.nivel_riesgo ?? 'null'] ?? 3) - (NIVEL_RIESGO_ORDER[b.nivel_riesgo ?? 'null'] ?? 3);
        return 0;
      });
  }, [parquesConEstado, filtroEstado, filtroRegion, busqueda, orden]);

  const contadores = useMemo(() => {
    const c = { rojo: 0, amarillo: 0, verde: 0, sin_alertas: 0 };
    parquesConEstado.forEach((p) => { c[p.estado]++; });
    return c;
  }, [parquesConEstado]);

  const isLoading = parques.isLoading || alertas.isLoading;

  function verEnMapa(parqueId: string) {
    useMapStore.getState().focusOnParque(parqueId);
    navigate('/dashboard');
  }

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4 pb-20 md:pb-4">

        {/* Contadores — clic para filtrar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {([
            ['rojo',        'Alerta Roja',     'border-accent-red/40 bg-accent-red/10',     'text-accent-red'],
            ['amarillo',    'Alerta Amarilla',  'border-amber-500/40 bg-amber-500/10',       'text-amber-400'],
            ['verde',       'Alerta Verde',     'border-accent-green/40 bg-accent-green/10', 'text-accent-green'],
            ['sin_alertas', 'Sin alertas',      'border-border-subtle bg-bg-surface',        'text-txt-muted'],
          ] as const).map(([nivel, label, clsBg, clsTxt]) => (
            <button key={nivel} type="button"
              onClick={() => setFiltroEstado(filtroEstado === nivel ? '' : nivel)}
              className={`panel p-3 md:p-4 text-center border-2 transition hover:brightness-110 ${clsBg} ${filtroEstado === nivel ? 'ring-2 ring-offset-1 ring-offset-bg ring-pnn-blue' : ''}`}>
              <div className={`text-2xl md:text-3xl font-bold font-mono ${clsTxt}`}>
                {contadores[nivel]}
              </div>
              <div className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider mt-0.5 ${clsTxt}`}>
                {label}
              </div>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="block">
            <span className="text-xs font-mono text-txt-muted block mb-1">BUSCAR</span>
            <input
              type="search" placeholder="Nombre del parque…" value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input-field !py-1.5 !text-xs w-48 md:w-64" />
          </div>
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">REGIÓN</span>
            <select value={filtroRegion} onChange={(e) => setFiltroRegion(e.target.value)}
              title="Región" aria-label="Región"
              className="mt-1 block input-field !py-1.5 !text-xs w-full md:w-52">
              <option value="">— Todas —</option>
              {regiones.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">ORDENAR POR</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}
              title="Ordenar por" aria-label="Ordenar por"
              className="mt-1 block input-field !py-1.5 !text-xs w-full md:w-40">
              <option value="estado">Estado de alerta</option>
              <option value="riesgo">Nivel de riesgo</option>
              <option value="nombre">Nombre</option>
            </select>
          </label>
          <div className="text-xs text-txt-muted font-mono self-end pb-1.5">
            {filtrados.length} de {parquesConEstado.length} áreas
          </div>
          <Link to="/dashboard" className="text-xs text-txt-muted hover:text-pnn-blue ml-auto self-end pb-1.5">
            ← Dashboard
          </Link>
        </div>

        {isLoading && (
          <div className="text-xs text-txt-muted text-center py-8">Cargando áreas protegidas…</div>
        )}

        {/* Grid de tarjetas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtrados.map((p) => {
            const probInc  = p.incendio   ? Number(p.incendio.probabilidad)   : null;
            const probInu  = p.inundacion ? Number(p.inundacion.probabilidad) : null;
            const ultimaAlerta = p.alertas[0];
            const ctx = p.ctx;
            const lluvia    = ctx?.lluvia_24h_mm  != null ? Number(ctx.lluvia_24h_mm).toFixed(1)  : null;
            const temp      = ctx?.temperatura_c  != null ? Number(ctx.temperatura_c).toFixed(1)  : null;
            const rio       = ctx?.nivel_rio_mt   != null ? Number(ctx.nivel_rio_mt).toFixed(2)   : null;
            const viento    = ctx?.viento_kmh     != null ? Number(ctx.viento_kmh).toFixed(0)     : null;
            const ctxAge    = ctx?.updated_at ?? null;

            return (
              <div key={p.id} className={`panel border-2 p-4 flex flex-col gap-3 ${estadoBg(p.estado)}`}>

                {/* Cabecera */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-txt leading-tight truncate" title={p.nombre}>
                      {p.nombre}
                    </div>
                    {p.region && (
                      <div className="text-[10px] text-txt-muted mt-0.5 truncate">{p.region}</div>
                    )}
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1 ${estadoDot(p.estado)}`} />
                </div>

                {/* Estado + conteo */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wide ${estadoTextColor(p.estado)}`}>
                    {estadoLabel(p.estado)}
                  </span>
                  {p.alertas.length > 0 && (
                    <span className="text-[10px] font-mono text-txt-muted">
                      {p.alertas.length} activa{p.alertas.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Última alerta activa */}
                {ultimaAlerta && (
                  <div className="text-[11px] text-txt-muted bg-bg-surface2 rounded px-2 py-1.5 leading-snug">
                    <div className="font-medium text-txt truncate">{ultimaAlerta.tipo}</div>
                    <div className="mt-0.5 font-mono">
                      {new Date(ultimaAlerta.fecha_inicio).toLocaleString('es-CO', {
                        timeZone: 'America/Bogota', day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                )}

                <div className="border-t border-border-subtle/50" />

                {/* Riesgo + área */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-txt-muted">Riesgo inherente</span>
                    {riesgoBadge(p.nivel_riesgo) ?? <span className="text-txt-muted">—</span>}
                  </div>
                  {p.area_ha != null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-txt-muted">Área</span>
                      <span className="font-mono text-txt">{p.area_ha.toLocaleString('es-CO')} ha</span>
                    </div>
                  )}
                </div>

                {/* Contexto climático */}
                {(lluvia != null || temp != null || rio != null || viento != null) && (
                  <>
                    <div className="border-t border-border-subtle/50" />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-mono text-txt-muted uppercase tracking-wider">Condiciones</span>
                        <span className="text-[9px] font-mono text-txt-muted">{minutesAgo(ctxAge)}</span>
                      </div>
                      {lluvia != null && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-txt-muted">🌧 Lluvia 24h</span>
                          <span className="font-mono text-txt">{lluvia} mm</span>
                        </div>
                      )}
                      {temp != null && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-txt-muted">🌡 Temperatura</span>
                          <span className="font-mono text-txt">{temp} °C</span>
                        </div>
                      )}
                      {viento != null && Number(viento) > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-txt-muted">💨 Viento</span>
                          <span className="font-mono text-txt">{viento} km/h</span>
                        </div>
                      )}
                      {rio != null && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-txt-muted">🏞 Nivel río</span>
                          <span className="font-mono text-txt">{rio} m</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* IA predictions */}
                {(probInc != null || probInu != null) && (
                  <>
                    <div className="border-t border-border-subtle/50" />
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-txt-muted uppercase tracking-wider">Predicción IA</span>
                      {probInc != null && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-txt-muted">🔥 Incendio</span>
                          <span className={`font-mono font-bold ${probColor(probInc)}`}>{probInc.toFixed(0)}%</span>
                        </div>
                      )}
                      {probInu != null && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-txt-muted">🌊 Inundación</span>
                          <span className={`font-mono font-bold ${probColor(probInu)}`}>{probInu.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Acciones */}
                <div className="mt-auto pt-1 flex gap-1.5">
                  <Link
                    to={`/historico?parque_id=${p.id}`}
                    className="flex-1 text-center text-[11px] font-mono text-pnn-blue hover:text-pnn-blue/80 border border-pnn-blue/30 rounded py-1 hover:bg-pnn-blue/5 transition">
                    Historial →
                  </Link>
                  <button type="button" onClick={() => verEnMapa(p.id)}
                    title="Ver en mapa"
                    className="text-[11px] font-mono text-txt-muted border border-border-subtle rounded px-2 py-1 hover:bg-bg-surface2 hover:text-txt transition">
                    🗺
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!isLoading && filtrados.length === 0 && (
          <div className="panel p-8 text-center text-txt-muted text-sm">
            No hay áreas con los filtros seleccionados.
          </div>
        )}
      </main>
    </div>
  );
}
