import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Alerta } from '../../types';

interface SummaryRow { nivel: 'rojo' | 'amarillo' | 'verde'; total: string }
interface Prediccion {
  id: string;
  tipo: 'incendio' | 'inundacion';
  probabilidad: string;
  parque_id: string;
  modelo_version: string;
  fecha: string;
}

export function MetricsPanel() {
  const summary = useQuery<SummaryRow[]>({
    queryKey: ['alertas-summary'],
    queryFn: async () => (await api.get('/alertas/summary')).data,
    refetchInterval: 15_000,
  });
  const hist = useQuery<Alerta[]>({
    queryKey: ['alertas-historico'],
    queryFn: async () => (await api.get('/alertas/historico?limit=50')).data,
    refetchInterval: 60_000,
  });
  const preds = useQuery<Prediccion[]>({
    queryKey: ['predicciones-latest'],
    queryFn: async () => (await api.get('/predicciones/latest')).data,
    refetchInterval: 60_000,
  });

  const count = (n: string) =>
    Number(summary.data?.find((r) => r.nivel === n)?.total ?? 0);

  const porParque = new Map<string, number>();
  hist.data?.forEach((a) => {
    const k = a.parque?.nombre ?? '—';
    porParque.set(k, (porParque.get(k) ?? 0) + 1);
  });
  const top5 = [...porParque.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const topPreds = (preds.data ?? [])
    .map((p) => ({ ...p, prob: Number(p.probabilidad) }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5);

  function probColor(p: number) {
    if (p >= 70) return 'text-accent-red';
    if (p >= 40) return 'text-accent-amber';
    return 'text-accent-green';
  }

  return (
    <aside className="panel flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-bold tracking-wider">MÉTRICAS EN TIEMPO REAL</h2>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2">
          {(['rojo', 'amarillo', 'verde'] as const).map((n) => (
            <div key={n} className={`rounded border p-3 text-center ${
              n === 'rojo' ? 'border-accent-red/40 bg-accent-red/5'
              : n === 'amarillo' ? 'border-accent-amber/40 bg-accent-amber/5'
              : 'border-accent-green/40 bg-accent-green/5'
            }`}>
              <div className={`stat-number text-2xl ${
                n === 'rojo' ? 'text-accent-red' : n === 'amarillo' ? 'text-accent-amber' : 'text-accent-green'
              }`}>{count(n)}</div>
              <div className="text-[10px] font-mono uppercase text-white/50">{n}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="text-[10px] font-mono text-white/50 mb-2">TOP PARQUES — ÚLTIMAS 50 ALERTAS</div>
          <div className="space-y-1">
            {top5.length === 0 && <div className="text-xs text-white/30">Sin datos aún</div>}
            {top5.map(([nombre, total]) => (
              <div key={nombre} className="flex items-center justify-between text-xs py-1 border-b border-border-subtle/50">
                <span className="truncate">{nombre}</span>
                <span className="font-mono text-accent-blue">{total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-3 bg-accent-blue/5 border-accent-blue/30">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono text-accent-blue">IA · PREDICCIONES</div>
            {topPreds[0] && (
              <div className="text-[9px] font-mono text-white/40">{topPreds[0].modelo_version}</div>
            )}
          </div>
          {topPreds.length === 0 && (
            <div className="text-xs text-white/40">Esperando primer ciclo del motor (cada 15 min)…</div>
          )}
          <div className="space-y-1.5">
            {topPreds.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="font-mono uppercase text-white/60 w-20">{p.tipo}</span>
                <div className="flex-1 mx-2 h-1.5 bg-bg-surface2 rounded overflow-hidden">
                  <div className={`h-full ${
                    p.prob >= 70 ? 'bg-accent-red' : p.prob >= 40 ? 'bg-accent-amber' : 'bg-accent-green'
                  }`} style={{ width: `${Math.min(p.prob, 100)}%` }} />
                </div>
                <span className={`font-mono w-10 text-right ${probColor(p.prob)}`}>{p.prob.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
