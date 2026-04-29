import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import type { Alerta, Parque } from '../types';

interface Prediccion {
  id: string;
  tipo: 'incendio' | 'inundacion';
  probabilidad: string;
  parque_id: string;
  fecha: string;
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
    rojo:       'border-accent-red/60 bg-accent-red/5',
    amarillo:   'border-amber-500/60 bg-amber-500/5',
    verde:      'border-accent-green/60 bg-accent-green/5',
    sin_alertas:'border-border-subtle bg-bg-surface',
  }[estado];
}

function estadoDot(estado: EstadoAlerta) {
  return {
    rojo:       'bg-accent-red animate-pulse',
    amarillo:   'bg-amber-500 animate-pulse',
    verde:      'bg-accent-green',
    sin_alertas:'bg-txt-muted',
  }[estado];
}

function estadoLabel(estado: EstadoAlerta) {
  return {
    rojo:       'ALERTA ROJA',
    amarillo:   'ALERTA AMARILLA',
    verde:      'ALERTA VERDE',
    sin_alertas:'Sin alertas',
  }[estado];
}

function estadoTextColor(estado: EstadoAlerta) {
  return {
    rojo:       'text-accent-red',
    amarillo:   'text-amber-400',
    verde:      'text-accent-green',
    sin_alertas:'text-txt-muted',
  }[estado];
}

function probColor(p: number) {
  if (p >= 70) return 'text-accent-red';
  if (p >= 40) return 'text-amber-400';
  return 'text-accent-green';
}

function riesgoBadge(nivel: string | null) {
  if (!nivel) return null;
  const cls = nivel === 'alto' ? 'chip-rojo' : nivel === 'medio' ? 'chip-amarillo' : 'chip-verde';
  return <span className={`chip ${cls}`}>{nivel}</span>;
}

export function EstadoParquesPage() {
  const [filtroEstado, setFiltroEstado] = useState<EstadoAlerta | ''>('');
  const [filtroRegion, setFiltroRegion] = useState('');
  const [orden, setOrden] = useState<'estado' | 'nombre' | 'riesgo'>('estado');

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

  const alertasPorParque = useMemo(() => {
    const m = new Map<string, Alerta[]>();
    alertas.data?.forEach((a) => {
      if (!a.parque_id) return;
      const prev = m.get(a.parque_id) ?? [];
      m.set(a.parque_id, [...prev, a]);
    });
    return m;
  }, [alertas.data]);

  const predsPorParque = useMemo(() => {
    const m = new Map<string, Prediccion[]>();
    preds.data?.forEach((p) => {
      const prev = m.get(p.parque_id) ?? [];
      m.set(p.parque_id, [...prev, p]);
    });
    return m;
  }, [preds.data]);

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
      return { ...p, estado, alertas: aps, incendio, inundacion };
    });
  }, [parques.data, alertasPorParque, predsPorParque]);

  const filtrados = useMemo(() => {
    return parquesConEstado
      .filter((p) => !filtroEstado || p.estado === filtroEstado)
      .filter((p) => !filtroRegion || (p.region ?? '') === filtroRegion)
      .sort((a, b) => {
        if (orden === 'estado') return ESTADO_ORDER[a.estado] - ESTADO_ORDER[b.estado];
        if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
        if (orden === 'riesgo') return (NIVEL_RIESGO_ORDER[a.nivel_riesgo ?? 'null'] ?? 3) - (NIVEL_RIESGO_ORDER[b.nivel_riesgo ?? 'null'] ?? 3);
        return 0;
      });
  }, [parquesConEstado, filtroEstado, filtroRegion, orden]);

  // Contadores para el header
  const contadores = useMemo(() => {
    const c = { rojo: 0, amarillo: 0, verde: 0, sin_alertas: 0 };
    parquesConEstado.forEach((p) => { c[p.estado]++; });
    return c;
  }, [parquesConEstado]);

  const isLoading = parques.isLoading || alertas.isLoading;

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4 pb-20 md:pb-4">

        {/* Header con contadores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {([
            ['rojo',       'Alerta Roja',     'border-accent-red/40 bg-accent-red/10',     'text-accent-red'],
            ['amarillo',   'Alerta Amarilla', 'border-amber-500/40 bg-amber-500/10',       'text-amber-400'],
            ['verde',      'Alerta Verde',    'border-accent-green/40 bg-accent-green/10', 'text-accent-green'],
            ['sin_alertas','Sin alertas',     'border-border-subtle bg-bg-surface',        'text-txt-muted'],
          ] as const).map(([nivel, label, clsBg, clsTxt]) => (
            <button key={nivel} type="button"
              onClick={() => setFiltroEstado(filtroEstado === nivel ? '' : nivel)}
              className={`panel p-3 md:p-4 text-center border-2 transition cursor-pointer hover:brightness-110 ${clsBg} ${filtroEstado === nivel ? 'ring-2 ring-offset-1 ring-offset-bg ring-pnn-blue' : ''}`}>
              <div className={`text-2xl md:text-3xl font-bold font-mono ${clsTxt}`}>
                {contadores[nivel]}
              </div>
              <div className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider mt-0.5 ${clsTxt}`}>
                {label}
              </div>
            </button>
          ))}
        </div>

        {/* Filtros y orden */}
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">REGIÓN</span>
            <select value={filtroRegion} onChange={(e) => setFiltroRegion(e.target.value)}
              title="Región" aria-label="Región"
              className="mt-1 block input-field !py-1.5 !text-xs w-full md:w-48">
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

        {/* Grid de tarjetas */}
        {isLoading && (
          <div className="text-xs text-txt-muted text-center py-8">Cargando áreas protegidas…</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtrados.map((p) => {
            const probInc = p.incendio ? Number(p.incendio.probabilidad) : null;
            const probInu = p.inundacion ? Number(p.inundacion.probabilidad) : null;
            const ultimaAlerta = p.alertas[0];

            return (
              <div key={p.id} className={`panel border-2 p-4 space-y-3 flex flex-col ${estadoBg(p.estado)}`}>
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-txt leading-tight truncate" title={p.nombre}>
                      {p.nombre}
                    </div>
                    {p.region && (
                      <div className="text-[11px] text-txt-muted mt-0.5">{p.region}</div>
                    )}
                  </div>
                  <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 mt-0.5 ${estadoDot(p.estado)}`} />
                </div>

                {/* Estado de alerta */}
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
                    <div className="mt-0.5">
                      {new Date(ultimaAlerta.fecha_inicio).toLocaleString('es-CO', {
                        timeZone: 'America/Bogota', day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                )}

                {/* Separador */}
                <div className="border-t border-border-subtle/50" />

                {/* Riesgo inherente + IA */}
                <div className="space-y-1.5">
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
                  {probInc != null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-txt-muted">🔥 IA incendio</span>
                      <span className={`font-mono font-bold ${probColor(probInc)}`}>{probInc.toFixed(0)}%</span>
                    </div>
                  )}
                  {probInu != null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-txt-muted">🌊 IA inundación</span>
                      <span className={`font-mono font-bold ${probColor(probInu)}`}>{probInu.toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                {/* Acción */}
                <div className="mt-auto pt-1">
                  <Link
                    to={`/historico?parque_id=${p.id}`}
                    className="block text-center text-[11px] font-mono text-pnn-blue hover:text-pnn-blue/80 border border-pnn-blue/30 rounded py-1 hover:bg-pnn-blue/5 transition">
                    Ver historial de alertas →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {!isLoading && filtrados.length === 0 && (
          <div className="panel p-8 text-center text-txt-muted text-sm">
            No hay áreas protegidas con los filtros seleccionados.
          </div>
        )}
      </main>
    </div>
  );
}
