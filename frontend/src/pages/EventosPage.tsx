import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import type { EventoClimatico } from '../types';

type TipoEvento = EventoClimatico['tipo'];

const TIPOS: TipoEvento[] = ['lluvia', 'incendio', 'viento', 'sequia', 'inundacion', 'temperatura', 'humedad', 'presion', 'nivel_rio'];

const TIPO_CHIP: Record<TipoEvento, string> = {
  lluvia:      'chip-verde',
  incendio:    'chip-rojo',
  viento:      'chip-amarillo',
  sequia:      'chip-rojo',
  inundacion:  'chip-amarillo',
  temperatura: 'chip-amarillo',
  humedad:     'chip-verde',
  presion:     'chip-verde',
  nivel_rio:   'chip-amarillo',
};

const TIPO_ICON: Record<TipoEvento, string> = {
  lluvia:      '🌧',
  incendio:    '🔥',
  viento:      '💨',
  sequia:      '☀️',
  inundacion:  '🌊',
  temperatura: '🌡',
  humedad:     '💧',
  presion:     '🔵',
  nivel_rio:   '🏞',
};

const TIPO_BAR_COLOR: Record<TipoEvento, string> = {
  lluvia:      'bg-blue-400',
  incendio:    'bg-red-500',
  viento:      'bg-amber-400',
  sequia:      'bg-orange-500',
  inundacion:  'bg-cyan-500',
  temperatura: 'bg-yellow-500',
  humedad:     'bg-teal-400',
  presion:     'bg-indigo-400',
  nivel_rio:   'bg-sky-600',
};

function toCsv(rows: EventoClimatico[]): string {
  const h = 'tipo,intensidad,unidad,fecha,fuente\n';
  return h + rows.map((e) =>
    `"${e.tipo}","${e.intensidad ?? ''}","${e.unidad ?? ''}","${e.fecha}","${e.fuente ?? ''}"`
  ).join('\n');
}

export function EventosPage() {
  const [tipo, setTipo] = useState('');
  const [hours, setHours] = useState('24');

  const params = useMemo(() => {
    const p: Record<string, string> = { hours, limit: '1000' };
    if (tipo) p.tipo = tipo;
    return p;
  }, [tipo, hours]);

  const eventos = useQuery<EventoClimatico[]>({
    queryKey: ['eventos', params],
    queryFn: async () => (await api.get('/eventos-climaticos', { params })).data,
    refetchInterval: 60_000,
  });

  const stats = useMemo(() => {
    if (!eventos.data) return {} as Record<TipoEvento, number>;
    return eventos.data.reduce<Record<string, number>>((acc, e) => {
      acc[e.tipo] = (acc[e.tipo] ?? 0) + 1;
      return acc;
    }, {}) as Record<TipoEvento, number>;
  }, [eventos.data]);

  const maxCount = Math.max(...Object.values(stats), 1);

  const download = () => {
    if (!eventos.data?.length) return;
    const blob = new Blob([toCsv(eventos.data)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eventos_climaticos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4 pb-20 md:pb-4">

        {/* Filters */}
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3 items-end">
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">TIPO</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              title="Tipo de evento" aria-label="Tipo de evento"
              className="mt-1 block input-field !py-1.5 !text-xs w-full md:w-40">
              <option value="">— Todos —</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>{TIPO_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">ÚLTIMAS</span>
            <select value={hours} onChange={(e) => setHours(e.target.value)}
              title="Período de tiempo" aria-label="Período de tiempo"
              className="mt-1 block input-field !py-1.5 !text-xs w-full md:w-36">
              <option value="6">6 horas</option>
              <option value="12">12 horas</option>
              <option value="24">24 horas</option>
              <option value="48">48 horas</option>
              <option value="72">72 horas</option>
              <option value="168">7 días</option>
            </select>
          </label>
          <button onClick={download} disabled={!eventos.data?.length}
            className="px-4 py-1.5 border border-pnn-blue text-pnn-blue rounded hover:bg-pnn-blue/10 text-xs font-mono disabled:opacity-30">
            CSV
          </button>
          <Link to="/dashboard" className="text-xs text-txt-muted hover:text-pnn-blue ml-auto">← Dashboard</Link>
        </div>

        {/* Summary bars */}
        <section className="panel p-4">
          <h2 className="text-sm font-bold tracking-wider mb-3">RESUMEN POR TIPO</h2>
          {eventos.isLoading && <div className="text-xs text-txt-light">Cargando…</div>}
          {!eventos.isLoading && Object.keys(stats).length === 0 && (
            <div className="text-xs text-txt-light">Sin eventos en el período seleccionado.</div>
          )}
          <div className="space-y-2">
            {TIPOS.filter((t) => stats[t] > 0).map((t) => (
              <div key={t} className="flex items-center gap-3">
                <span className="text-sm w-5">{TIPO_ICON[t]}</span>
                <span className="text-xs font-mono text-txt-muted w-20 shrink-0">{t.toUpperCase()}</span>
                <div className="flex-1 bg-bg-surface2 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${TIPO_BAR_COLOR[t]} h-full rounded-full transition-all`}
                    style={{ width: `${(stats[t] / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-txt w-10 text-right">{stats[t]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Table */}
        <section className="panel overflow-hidden flex flex-col max-h-[55vh]">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider">
              EVENTOS ({eventos.data?.length ?? 0})
            </h2>
            {eventos.isFetching && !eventos.isLoading && (
              <span className="text-[10px] font-mono text-txt-muted animate-pulse">actualizando…</span>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">TIPO</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">INTENSIDAD</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">FECHA</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">FUENTE</th>
                </tr>
              </thead>
              <tbody>
                {eventos.isLoading && (
                  <tr><td colSpan={4} className="text-center py-6 text-txt-light">Cargando…</td></tr>
                )}
                {eventos.data?.map((e) => (
                  <tr key={e.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2">
                      <span className={`chip ${TIPO_CHIP[e.tipo]}`}>
                        {TIPO_ICON[e.tipo]} {e.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {e.intensidad != null
                        ? `${e.intensidad}${e.unidad ? ' ' + e.unidad : ''}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-txt-muted">
                      {new Date(e.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                    </td>
                    <td className="px-3 py-2 text-txt-muted">{e.fuente ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
