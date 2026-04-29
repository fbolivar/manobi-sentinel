import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { EventoClimatico } from '../../types';

type Filtro = 'todos' | 'incendio' | 'lluvia' | 'temperatura' | 'viento' | 'humedad';

const TIPO_COLOR: Record<string, string> = {
  incendio: 'text-red-600', lluvia: 'text-blue-600',
  temperatura: 'text-amber-600', viento: 'text-emerald-600',
  humedad: 'text-cyan-600', presion: 'text-purple-600',
};
const TIPO_ICON: Record<string, string> = {
  incendio: '🔥', lluvia: '🌧', temperatura: '🌡', viento: '💨', humedad: '💧', presion: '📊',
};

export function BottomTimeline() {
  const [expanded, setExpanded] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const { data } = useQuery<EventoClimatico[]>({
    queryKey: ['eventos-24h'],
    queryFn: async () => (await api.get('/eventos-climaticos?hours=24')).data,
    refetchInterval: 30_000,
  });

  const resumen = useMemo(() => {
    if (!data?.length) return null;
    const r: Record<string, { count: number; sum: number; max: number; avg: number }> = {};
    data.forEach((e) => {
      if (!r[e.tipo]) r[e.tipo] = { count: 0, sum: 0, max: -Infinity, avg: 0 };
      r[e.tipo].count++;
      const v = Number(e.intensidad ?? 0);
      r[e.tipo].sum += v;
      if (v > r[e.tipo].max) r[e.tipo].max = v;
    });
    Object.values(r).forEach((s) => { s.avg = s.count ? s.sum / s.count : 0; });
    return r;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return (filtro === 'todos' ? data : data.filter((e) => e.tipo === filtro)).slice(0, 50);
  }, [data, filtro]);

  /* ---- Colapsado ---- */
  if (!expanded) {
    return (
      <div className="panel h-12 flex items-center px-3 gap-3 cursor-pointer select-none hover:shadow-card-hover transition"
        onClick={() => setExpanded(true)} role="button" tabIndex={0}>
        <span className="text-[10px] font-semibold text-txt-muted shrink-0">24H</span>
        <div className="flex-1 flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {resumen && Object.entries(resumen).map(([tipo, s]) => (
            <div key={tipo} className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm">{TIPO_ICON[tipo] ?? '📡'}</span>
              <span className={`text-xs font-bold ${TIPO_COLOR[tipo] ?? 'text-txt'}`}>{s.count}</span>
              <span className="text-[10px] text-txt-light hidden md:inline">{tipo}</span>
            </div>
          ))}
          {!resumen && <span className="text-xs text-txt-light">Sin datos</span>}
        </div>
        <span className="text-txt-light text-[10px] shrink-0">▲ expandir</span>
      </div>
    );
  }

  /* ---- Expandido ---- */
  return (
    <div className="panel flex flex-col max-h-[220px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle shrink-0">
        <button type="button" onClick={() => setExpanded(false)}
          className="text-txt-muted hover:text-txt text-xs touch-target flex items-center">▼</button>
        <span className="text-[10px] font-semibold text-txt-muted uppercase">Eventos 24H</span>
        <span className="text-xs font-bold text-pnn-blue">{data?.length ?? 0}</span>
        <div className="flex-1" />
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {(['todos', 'incendio', 'lluvia', 'temperatura', 'viento', 'humedad'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFiltro(f)}
              className={`px-2 py-1 text-[10px] font-semibold rounded-lg transition whitespace-nowrap ${
                filtro === f ? 'bg-pnn-green/10 text-pnn-green-dark border border-pnn-green/30' : 'text-txt-muted hover:text-txt hover:bg-bg-surface2'
              }`}>
              {f === 'todos' ? 'Todos' : `${TIPO_ICON[f]} ${f}`}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border-subtle bg-bg-surface2/50 shrink-0 overflow-x-auto scrollbar-hide">
        {resumen && Object.entries(resumen).map(([tipo, s]) => (
          <div key={tipo} className="flex items-center gap-1 shrink-0 text-[10px] font-mono">
            <span>{TIPO_ICON[tipo]}</span>
            <span className={`font-bold ${TIPO_COLOR[tipo]}`}>{s.count}</span>
            <span className="text-txt-light">|</span>
            <span className="text-txt-muted">prom {s.avg.toFixed(1)}</span>
            <span className="text-txt-light">|</span>
            <span className="text-txt-muted">máx {s.max === -Infinity ? '0' : s.max.toFixed(1)}</span>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1.5 p-2">
          {filtered.map((e) => (
            <div key={e.id}
              className="panel px-2.5 py-2 hover:shadow-card-hover transition text-left">
              <div className={`text-[11px] font-bold uppercase ${TIPO_COLOR[e.tipo] ?? 'text-txt-muted'}`}>
                {TIPO_ICON[e.tipo] ?? '📡'} {e.tipo}
              </div>
              <div className="text-sm font-mono font-semibold text-txt">
                {e.intensidad != null ? `${Number(e.intensidad).toFixed(1)} ${e.unidad ?? ''}` : '—'}
              </div>
              <div className="text-[10px] text-txt-muted flex justify-between mt-0.5">
                <span>{new Date(e.fecha).toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' })}</span>
                <span className="truncate ml-1">{(e.fuente ?? '').replace('IDEAM-', '').replace('NASA_FIRMS-', '').slice(0, 8)}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-xs text-txt-light py-4">Sin eventos de tipo "{filtro}"</div>
          )}
        </div>
      </div>
    </div>
  );
}
