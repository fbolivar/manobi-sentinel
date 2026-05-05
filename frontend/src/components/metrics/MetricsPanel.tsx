import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Parque } from '../../types';

interface SummaryRow { nivel: 'rojo' | 'amarillo' | 'verde'; total: string }
interface Prediccion {
  id: string;
  tipo: 'incendio' | 'inundacion';
  probabilidad: string;
  parque_id: string;
  modelo_version: string;
  fecha: string;
}
interface HotspotFeature {
  properties: { parque?: string; confianza?: number; frp?: number };
}

export function MetricsPanel() {
  const [showPredInfo, setShowPredInfo] = useState(false);
  const summary = useQuery<SummaryRow[]>({
    queryKey: ['alertas-summary'],
    queryFn: async () => (await api.get('/alertas/summary')).data,
    refetchInterval: 15_000,
  });
  const preds = useQuery<Prediccion[]>({
    queryKey: ['predicciones-latest'],
    queryFn: async () => (await api.get('/predicciones/latest')).data,
    refetchInterval: 60_000,
  });
  const parques = useQuery<Parque[]>({
    queryKey: ['parques-list'],
    queryFn: async () => (await api.get('/parques')).data,
    staleTime: 5 * 60_000,
  });
  const hotspotsQ = useQuery<{ features: HotspotFeature[] }>({
    queryKey: ['hotspots-metrics'],
    queryFn: async () => (await api.get('/hotspots', { params: { hours: 24 } })).data,
    refetchInterval: 15 * 60_000,
    staleTime: 10 * 60_000,
  });

  const nombreParque = (id: string) =>
    parques.data?.find((p) => p.id === id)?.nombre ?? '—';

  const count = (n: string) =>
    Number(summary.data?.find((r) => r.nivel === n)?.total ?? 0);

  const { topAreas, confianzaCounts } = useMemo(() => {
    const features = hotspotsQ.data?.features ?? [];
    const byArea = new Map<string, number>();
    let alto = 0, medio = 0, bajo = 0;
    features.forEach((f) => {
      const nombre = f.properties.parque ?? 'Fuera de área';
      byArea.set(nombre, (byArea.get(nombre) ?? 0) + 1);
      const conf = f.properties.confianza ?? 50;
      if (conf > 70) alto++;
      else if (conf >= 40) medio++;
      else bajo++;
    });
    const topAreas = [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { topAreas, confianzaCounts: { alto, medio, bajo, total: features.length } };
  }, [hotspotsQ.data]);

  const topPreds = (preds.data ?? [])
    .filter((p) => p.tipo === 'incendio')
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
      <div className="p-4 pb-6 space-y-3 overflow-y-auto">
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

        {/* Focos de calor por área · últimas 24h */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-txt-muted uppercase tracking-wider">
              🔥 Focos activos por área · 24h
            </div>
            <span className="text-[10px] font-mono text-txt-muted">{confianzaCounts.total} total</span>
          </div>
          {topAreas.length === 0 && (
            <div className="text-xs text-txt-light">Sin focos activos</div>
          )}
          <div className="space-y-1.5">
            {topAreas.map(([nombre, cnt]) => {
              const pct = confianzaCounts.total > 0 ? (cnt / confianzaCounts.total) * 100 : 0;
              return (
                <div key={nombre}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="truncate text-txt flex-1 min-w-0">{nombre}</span>
                    <span className="font-mono font-bold text-orange-500 ml-2 shrink-0">{cnt}</span>
                  </div>
                  <div className="h-1.5 bg-bg-surface2 rounded-full overflow-hidden">
                    {/* eslint-disable-next-line react/forbid-component-props */}
                    <div className="h-full rounded-full bg-orange-500 transition-all"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Distribución por confianza */}
          {confianzaCounts.total > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border-subtle">
              <div className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider mb-1.5">Por nivel de confianza</div>
              {/* eslint-disable react/forbid-component-props */}
              <div className="flex gap-1 h-3 rounded overflow-hidden">
                {confianzaCounts.alto > 0 && (
                  <div className="bg-red-500 rounded-sm"
                    style={{ width: `${(confianzaCounts.alto / confianzaCounts.total) * 100}%` }}
                    title={`Alto >70%: ${confianzaCounts.alto}`} />
                )}
                {confianzaCounts.medio > 0 && (
                  <div className="bg-amber-500 rounded-sm"
                    style={{ width: `${(confianzaCounts.medio / confianzaCounts.total) * 100}%` }}
                    title={`Medio 40–70%: ${confianzaCounts.medio}`} />
                )}
                {confianzaCounts.bajo > 0 && (
                  <div className="bg-green-500 rounded-sm"
                    style={{ width: `${(confianzaCounts.bajo / confianzaCounts.total) * 100}%` }}
                    title={`Bajo <40%: ${confianzaCounts.bajo}`} />
                )}
              </div>
              {/* eslint-enable react/forbid-component-props */}
              <div className="flex items-center gap-3 mt-1 text-[10px] font-mono">
                <span className="text-red-500">● alto {confianzaCounts.alto}</span>
                <span className="text-amber-500">● medio {confianzaCounts.medio}</span>
                <span className="text-green-500">● bajo {confianzaCounts.bajo}</span>
              </div>
            </div>
          )}
        </div>

        {/* Predicciones IA */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="text-xs font-bold text-pnn-blue uppercase tracking-wider">IA · Incendio Forestal</div>
              <button
                type="button"
                onClick={() => setShowPredInfo((v) => !v)}
                className="text-[11px] text-txt-muted hover:text-pnn-blue leading-none"
                aria-label="Información sobre la predicción">
                ⓘ
              </button>
            </div>
            {topPreds[0] && (
              <span className="text-[10px] text-txt-light bg-white px-1.5 py-0.5 rounded cursor-help"
                title={`Modelo scikit-learn versión ${topPreds[0].modelo_version}. Actualizado cada 15 min por el motor de alertas.`}>
                modelo {topPreds[0].modelo_version}
              </span>
            )}
          </div>
          {showPredInfo && (
            <div className="relative mt-2 mb-1 rounded-md border border-blue-300 bg-white p-3 text-[10px] text-gray-700 leading-snug shadow-md z-10">
              <button
                type="button"
                onClick={() => setShowPredInfo(false)}
                className="absolute top-1.5 right-2 text-gray-400 hover:text-gray-700 text-sm leading-none"
                aria-label="Cerrar">
                ×
              </button>
              <p className="font-semibold text-[11px] text-gray-900 mb-1">¿Qué mide esta predicción?</p>
              <p className="mb-1.5">Estima la probabilidad de incendio forestal en cada área protegida para las próximas 24 horas.</p>
              <p className="font-semibold text-gray-800 mb-0.5">Fuente de datos:</p>
              <p className="mb-1.5">Satélites OroraTech (focos de calor, FRP, confianza) + condiciones hidrometeorológicas.</p>
              <p className="font-semibold text-gray-800 mb-0.5">Metodología:</p>
              <p className="mb-1.5">Modelo de IA (Anthropic Claude) que correlaciona detecciones satelitales activas, condiciones de temperatura, humedad, días sin lluvia y viento para calcular un índice de riesgo.</p>
              <p className="font-semibold text-gray-800 mb-0.5">Escala:</p>
              <p>
                <span className="text-green-600">&lt;40% bajo</span>
                {' · '}
                <span className="text-amber-600">40–70% medio</span>
                {' · '}
                <span className="text-red-600">&gt;70% alto</span>
                . Es un estimado probabilístico, no una certeza.
              </p>
            </div>
          )}
          <div className="text-[10px] text-txt-muted mt-0.5 mb-3 leading-snug">
            Top 5 parques por probabilidad estimada de incendio forestal · próximas 24 h.
            <span className="block mt-0.5">
              <span className="text-green-600">bajo &lt;40%</span> ·{' '}
              <span className="text-amber-600">medio 40–70%</span> ·{' '}
              <span className="text-red-600">alto &gt;70%</span>
            </span>
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
                    {/* eslint-disable-next-line react/forbid-component-props */}
                    <div className={`h-full rounded-full transition-all ${barColor(p.prob)}`}
                      style={{ width: `${Math.min(p.prob, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
