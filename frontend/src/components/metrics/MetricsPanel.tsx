import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Alerta, Parque } from '../../types';

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
  // Necesario para resolver parque_id -> nombre en las filas de predicciones.
  const parques = useQuery<Parque[]>({
    queryKey: ['parques-list'],
    queryFn: async () => (await api.get('/parques')).data,
    staleTime: 5 * 60_000,
  });
  const nombreParque = (id: string) =>
    parques.data?.find((p) => p.id === id)?.nombre ?? '—';

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
    if (p >= 70) return 'text-red-600';
    if (p >= 40) return 'text-amber-600';
    return 'text-green-700';
  }
  function barColor(p: number) {
    if (p >= 70) return 'bg-red-500';
    if (p >= 40) return 'bg-amber-500';
    return 'bg-green-500';
  }

  return (
    <aside className="panel flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-txt tracking-wide">Métricas en tiempo real</h2>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto">
        {/* Contadores por nivel */}
        <div className="grid grid-cols-3 gap-2">
          {(['rojo', 'amarillo', 'verde'] as const).map((n) => (
            <div key={n} className={`rounded-lg border p-3 text-center ${
              n === 'rojo' ? 'border-red-200 bg-red-50'
              : n === 'amarillo' ? 'border-amber-200 bg-amber-50'
              : 'border-green-200 bg-green-50'
            }`}>
              <div className={`stat-number text-2xl ${
                n === 'rojo' ? 'text-red-600' : n === 'amarillo' ? 'text-amber-600' : 'text-green-600'
              }`}>{count(n)}</div>
              <div className={`text-[10px] font-semibold uppercase ${
                n === 'rojo' ? 'text-red-400' : n === 'amarillo' ? 'text-amber-400' : 'text-green-400'
              }`}>{n}</div>
            </div>
          ))}
        </div>

        {/* Top parques */}
        <div>
          <div className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">Top parques</div>
          <div className="space-y-0.5">
            {top5.length === 0 && <div className="text-xs text-txt-light">Sin datos aún</div>}
            {top5.map(([nombre, total]) => (
              <div key={nombre} className="flex items-center justify-between text-xs py-1.5 border-b border-border-subtle">
                <span className="truncate text-txt">{nombre}</span>
                <span className="font-mono font-bold text-pnn-blue ml-2">{total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Predicciones IA */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-pnn-blue uppercase tracking-wider">IA · Predicciones</div>
            {topPreds[0] && (
              <span className="text-[10px] text-txt-light bg-white px-1.5 py-0.5 rounded cursor-help"
                title={`Modelo scikit-learn versión ${topPreds[0].modelo_version}. Actualizado cada 15 min por el motor de alertas.`}>
                modelo {topPreds[0].modelo_version}
              </span>
            )}
          </div>
          <div className="text-[10px] text-txt-muted mt-0.5 mb-3 leading-snug">
            Probabilidad estimada de incendio o inundación por parque en las próximas 24 h · top 5 de riesgo actual
          </div>
          {topPreds.length === 0 && (
            <div className="text-xs text-txt-muted">Esperando primer ciclo…</div>
          )}
          <div className="space-y-2.5">
            {topPreds.map((p) => {
              const isFire = p.tipo === 'incendio';
              const nombre = nombreParque(p.parque_id);
              const fechaTxt = new Date(p.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
              return (
                <div key={p.id}
                  className="text-xs"
                  title={`${isFire ? 'Incendio' : 'Inundación'} · ${nombre}\nProbabilidad: ${p.prob.toFixed(1)}%\nCalculada: ${fechaTxt}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-sm shrink-0 ${isFire ? 'text-orange-500' : 'text-blue-500'}`}
                      aria-label={isFire ? 'Incendio' : 'Inundación'}>
                      {isFire ? '🔥' : '💧'}
                    </span>
                    <span className="text-txt truncate flex-1 min-w-0">{nombre}</span>
                    <span className={`font-mono font-bold shrink-0 text-[11px] ${probColor(p.prob)}`}>
                      {p.prob.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-white rounded-full overflow-hidden border border-gray-200">
                    <div className={`h-full rounded-full transition-all ${barColor(p.prob)}`}
                      style={{ width: `${Math.min(p.prob, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[9px] text-txt-light mt-3 pt-2 border-t border-blue-200/60">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500"/>alto &gt;70</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>medio 40-70</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500"/>bajo &lt;40</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
