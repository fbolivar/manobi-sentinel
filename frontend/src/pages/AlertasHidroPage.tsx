import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import type { EventoClimatico } from '../types';

type TipoFiltro = 'todos' | 'lluvia' | 'temperatura' | 'humedad' | 'viento' | 'nivel_rio' | 'presion' | 'sequia';
type HorasFiltro = '6' | '12' | '24' | '48' | '72' | '168';

const TIPO_ICON: Record<string, string> = {
  lluvia: '🌧', temperatura: '🌡', humedad: '💧', viento: '💨',
  nivel_rio: '🌊', presion: '📊', sequia: '☀️',
};
const TIPO_COLOR: Record<string, string> = {
  lluvia: 'text-blue-600', temperatura: 'text-amber-600', humedad: 'text-cyan-600',
  viento: 'text-emerald-600', nivel_rio: 'text-indigo-600', presion: 'text-purple-600',
  sequia: 'text-orange-600',
};
const TIPO_BG: Record<string, string> = {
  lluvia: 'bg-blue-50 border-blue-200', temperatura: 'bg-amber-50 border-amber-200',
  humedad: 'bg-cyan-50 border-cyan-200', viento: 'bg-emerald-50 border-emerald-200',
  nivel_rio: 'bg-indigo-50 border-indigo-200', presion: 'bg-purple-50 border-purple-200',
  sequia: 'bg-orange-50 border-orange-200',
};

const TIPOS_HIDRO: TipoFiltro[] = ['lluvia', 'temperatura', 'humedad', 'viento', 'nivel_rio', 'presion', 'sequia'];

const UNIDAD_DEFAULT: Record<string, string> = {
  lluvia: 'mm', temperatura: '°C', humedad: '%', viento: 'km/h',
  nivel_rio: 'm', presion: 'hPa', sequia: 'd',
};

function formatIntensidad(e: EventoClimatico): string {
  if (e.intensidad == null) return '—';
  const u = e.unidad ?? UNIDAD_DEFAULT[e.tipo] ?? '';
  return `${Number(e.intensidad).toFixed(1)} ${u}`;
}

export function AlertasHidroPage() {
  const [horas, setHoras] = useState<HorasFiltro>('24');
  const [filtro, setFiltro] = useState<TipoFiltro>('todos');

  const { data, isLoading } = useQuery<EventoClimatico[]>({
    queryKey: ['eventos-hidro', horas],
    queryFn: async () => (await api.get('/eventos-climaticos', {
      params: { fuente: 'IDEAM', hours: horas, limit: 2000 },
    })).data,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const resumen = useMemo(() => {
    const r: Record<string, { count: number; sum: number; max: number; min: number }> = {};
    (data ?? []).forEach((e) => {
      if (!r[e.tipo]) r[e.tipo] = { count: 0, sum: 0, max: -Infinity, min: Infinity };
      r[e.tipo].count++;
      const v = Number(e.intensidad ?? 0);
      r[e.tipo].sum += v;
      if (v > r[e.tipo].max) r[e.tipo].max = v;
      if (v < r[e.tipo].min) r[e.tipo].min = v;
    });
    return r;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filtro === 'todos' ? data : data.filter((e) => e.tipo === filtro);
  }, [data, filtro]);

  const horasLabel = (h: HorasFiltro) => h === '168' ? '7d' : `${h}h`;

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4 space-y-3 md:space-y-4">

        {/* Header */}
        <div className="panel px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold tracking-wider">ALERTAS HIDROMETEOROLÓGICAS · IDEAM</h1>
            <p className="text-[10px] text-txt-muted mt-0.5">
              Lluvia · Temperatura · Humedad · Viento · Nivel río · Presión · Sequía
            </p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(['6','12','24','48','72','168'] as HorasFiltro[]).map((h) => (
              <button key={h} type="button" onClick={() => setHoras(h)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
                  horas === h
                    ? 'bg-pnn-blue/20 border-pnn-blue text-pnn-blue'
                    : 'border-border-subtle text-txt-muted hover:border-pnn-blue/50 hover:text-txt'
                }`}>
                {horasLabel(h)}
              </button>
            ))}
          </div>
          <div className="text-xs text-txt-muted font-mono shrink-0">
            {isLoading ? 'Cargando…' : `${data?.length ?? 0} registros`}
          </div>
        </div>

        {/* Tarjetas resumen por tipo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {TIPOS_HIDRO.map((tipo) => {
            const s = resumen[tipo];
            const avg = s ? s.sum / s.count : null;
            return (
              <button key={tipo} type="button"
                onClick={() => setFiltro((f) => f === tipo ? 'todos' : tipo)}
                className={`panel rounded-lg border p-3 text-left transition hover:brightness-95 ${
                  filtro === tipo ? 'ring-2 ring-pnn-blue' : ''
                } ${TIPO_BG[tipo] ?? 'bg-bg-surface2 border-border-subtle'}`}>
                <div className="text-lg mb-1">{TIPO_ICON[tipo]}</div>
                <div className={`text-[11px] font-bold uppercase ${TIPO_COLOR[tipo] ?? 'text-txt'}`}>{tipo}</div>
                <div className="text-xl font-mono font-bold text-txt mt-0.5">{s?.count ?? 0}</div>
                {avg != null && s && (
                  <div className="text-[10px] text-txt-muted mt-0.5">
                    prom {avg.toFixed(1)} · máx {s.max === -Infinity ? '—' : s.max.toFixed(1)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Filtro tipo pills */}
        <div className="panel px-4 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-txt-muted uppercase">Filtro:</span>
          <button type="button" onClick={() => setFiltro('todos')}
            className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition ${
              filtro === 'todos' ? 'bg-pnn-green/10 text-pnn-green-dark border border-pnn-green/30' : 'text-txt-muted hover:text-txt hover:bg-bg-surface2'
            }`}>
            Todos ({data?.length ?? 0})
          </button>
          {TIPOS_HIDRO.filter((t) => resumen[t]).map((t) => (
            <button key={t} type="button" onClick={() => setFiltro((f) => f === t ? 'todos' : t)}
              className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition ${
                filtro === t ? 'bg-pnn-green/10 text-pnn-green-dark border border-pnn-green/30' : 'text-txt-muted hover:text-txt hover:bg-bg-surface2'
              }`}>
              {TIPO_ICON[t]} {t} ({resumen[t].count})
            </button>
          ))}
        </div>

        {/* Tabla / cards */}
        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-txt-muted uppercase">
              {filtro === 'todos' ? 'Todos los registros' : `${TIPO_ICON[filtro]} ${filtro}`}
              <span className="ml-2 font-mono text-pnn-blue">{filtered.length}</span>
            </h2>
            <Link to="/dashboard" className="text-[10px] text-txt-muted hover:text-pnn-blue">← Dashboard</Link>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* Desktop table */}
            <table className="w-full text-xs hidden md:table">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">TIPO</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">VALOR</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">FUENTE</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">FECHA / HORA</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={4} className="text-center py-6 text-txt-light">Cargando…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-txt-light">Sin datos en las últimas {horasLabel(horas)}</td></tr>
                )}
                {filtered.slice(0, 500).map((e) => (
                  <tr key={e.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2">
                      <span className={`font-semibold ${TIPO_COLOR[e.tipo] ?? 'text-txt'}`}>
                        {TIPO_ICON[e.tipo] ?? '📡'} {e.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-txt">{formatIntensidad(e)}</td>
                    <td className="px-3 py-2 text-txt-muted font-mono text-[10px]">
                      {(e.fuente ?? '—').replace('IDEAM-', '')}
                    </td>
                    <td className="px-3 py-2 font-mono text-txt-muted">
                      {new Date(e.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border-subtle">
              {isLoading && <div className="p-4 text-xs text-txt-light">Cargando…</div>}
              {!isLoading && filtered.length === 0 && (
                <div className="p-6 text-center text-xs text-txt-light">Sin datos en las últimas {horasLabel(horas)}</div>
              )}
              {filtered.slice(0, 200).map((e) => (
                <div key={e.id} className="p-3 flex items-center gap-3">
                  <div className="text-xl">{TIPO_ICON[e.tipo] ?? '📡'}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold uppercase ${TIPO_COLOR[e.tipo] ?? 'text-txt'}`}>{e.tipo}</div>
                    <div className="text-sm font-mono font-semibold text-txt">{formatIntensidad(e)}</div>
                    <div className="text-[10px] text-txt-muted font-mono">
                      {new Date(e.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false })}
                    </div>
                  </div>
                  <div className="text-[10px] text-txt-muted font-mono text-right">
                    {(e.fuente ?? '—').replace('IDEAM-', '')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
