import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import type { Alerta, Parque } from '../types';

interface StatRow { dia: string; nivel: string; total: string; }

const NIVEL_COLOR: Record<string, string> = {
  rojo: 'bg-accent-red/80', amarillo: 'bg-yellow-500/80', verde: 'bg-accent-green/80',
};

function toCsv(rows: Alerta[]): string {
  const h = 'tipo,nivel,parque,estado,fecha_inicio,fecha_fin\n';
  return h + rows.map((a) =>
    `"${a.tipo}","${a.nivel}","${a.parque?.nombre ?? ''}","${a.estado}","${a.fecha_inicio}","${a.fecha_fin ?? ''}"`
  ).join('\n');
}

export function HistoricoPage() {
  const [parqueId, setParqueId] = useState('');
  const [nivel, setNivel] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (parqueId) p.parque_id = parqueId;
    if (nivel) p.nivel = nivel;
    if (desde) p.desde = new Date(desde).toISOString();
    if (hasta) p.hasta = new Date(hasta).toISOString();
    return p;
  }, [parqueId, nivel, desde, hasta]);

  const parques = useQuery<Parque[]>({
    queryKey: ['parques-list'],
    queryFn: async () => (await api.get('/parques')).data,
    staleTime: 5 * 60_000,
  });

  const alertas = useQuery<Alerta[]>({
    queryKey: ['historico', params],
    queryFn: async () => (await api.get('/alertas/historico', { params: { ...params, limit: 500 } })).data,
  });

  const stats = useQuery<StatRow[]>({
    queryKey: ['historico-stats', params],
    queryFn: async () => (await api.get('/alertas/historico/stats', { params })).data,
  });

  const maxDay = useMemo(() => {
    if (!stats.data?.length) return 1;
    const byDay: Record<string, number> = {};
    stats.data.forEach((r) => { byDay[r.dia] = (byDay[r.dia] ?? 0) + Number(r.total); });
    return Math.max(...Object.values(byDay), 1);
  }, [stats.data]);

  const days = useMemo(() => {
    if (!stats.data?.length) return [];
    const map: Record<string, Record<string, number>> = {};
    stats.data.forEach((r) => {
      const d = r.dia.split('T')[0];
      map[d] = map[d] ?? {};
      map[d][r.nivel] = Number(r.total);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [stats.data]);

  const download = () => {
    if (!alertas.data?.length) return;
    const blob = new Blob([toCsv(alertas.data)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `alertas_historico_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block">
            <span className="text-xs font-mono text-white/50">PARQUE</span>
            <select value={parqueId} onChange={(e) => setParqueId(e.target.value)}
              title="Parque" aria-label="Parque"
              className="mt-1 block bg-bg-surface2 border border-border-subtle rounded px-2 py-1.5 font-mono text-xs w-56">
              <option value="">— Todos —</option>
              {parques.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-mono text-white/50">NIVEL</span>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)}
              title="Nivel" aria-label="Nivel"
              className="mt-1 block bg-bg-surface2 border border-border-subtle rounded px-2 py-1.5 font-mono text-xs w-32">
              <option value="">Todos</option>
              <option value="rojo">Rojo</option>
              <option value="amarillo">Amarillo</option>
              <option value="verde">Verde</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-mono text-white/50">DESDE</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="mt-1 block bg-bg-surface2 border border-border-subtle rounded px-2 py-1.5 font-mono text-xs" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-white/50">HASTA</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="mt-1 block bg-bg-surface2 border border-border-subtle rounded px-2 py-1.5 font-mono text-xs" />
          </label>
          <button onClick={download} disabled={!alertas.data?.length}
            className="px-4 py-1.5 border border-accent-blue text-accent-blue rounded hover:bg-accent-blue/10 text-xs font-mono disabled:opacity-30">
            CSV
          </button>
          <Link to="/dashboard" className="text-xs text-white/50 hover:text-accent-blue ml-auto">← Dashboard</Link>
        </div>

        <section className="panel p-4">
          <h2 className="text-sm font-bold tracking-wider mb-3">ALERTAS POR DÍA</h2>
          {days.length === 0 && <div className="text-xs text-white/40">Sin datos para el rango seleccionado.</div>}
          <div className="flex items-end gap-1 h-40 overflow-x-auto">
            {days.map(([day, levels]) => {
              const total = Object.values(levels).reduce((s, n) => s + n, 0);
              return (
                <div key={day} className="flex flex-col items-center min-w-[28px]" title={`${day}: ${total}`}>
                  <div className="flex flex-col-reverse w-5" style={{ height: `${(total / maxDay) * 100}%`, minHeight: 4 }}>
                    {['rojo', 'amarillo', 'verde'].map((n) => levels[n] ? (
                      <div key={n} className={`${NIVEL_COLOR[n]} w-full`}
                        style={{ height: `${(levels[n] / total) * 100}%`, minHeight: 2 }} />
                    ) : null)}
                  </div>
                  <span className="text-[8px] font-mono text-white/40 mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap">
                    {day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel overflow-hidden flex flex-col max-h-[50vh]">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider">HISTORIAL ({alertas.data?.length ?? 0})</h2>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-white/50">TIPO</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">NIVEL</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">PARQUE</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">ESTADO</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">FECHA</th>
                </tr>
              </thead>
              <tbody>
                {alertas.isLoading && <tr><td colSpan={5} className="text-center py-6 text-white/40">Cargando…</td></tr>}
                {alertas.data?.map((a) => (
                  <tr key={a.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2">{a.tipo}</td>
                    <td className="px-3 py-2">
                      <span className={`chip chip-${a.nivel === 'rojo' ? 'rojo' : a.nivel === 'amarillo' ? 'amarillo' : 'verde'}`}>
                        {a.nivel.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 truncate max-w-xs">{a.parque?.nombre ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-white/60">{a.estado}</td>
                    <td className="px-3 py-2 font-mono text-white/60">
                      {new Date(a.fecha_inicio).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                    </td>
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
