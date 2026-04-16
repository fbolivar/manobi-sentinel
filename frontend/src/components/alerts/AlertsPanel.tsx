import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '../../lib/api';
import type { Alerta } from '../../types';

function nivelChip(n: Alerta['nivel']) {
  const map = { rojo: 'chip-rojo', amarillo: 'chip-amarillo', verde: 'chip-verde' } as const;
  return <span className={`chip ${map[n]}`}>{n.toUpperCase()}</span>;
}

export function AlertsPanel() {
  const { data, isLoading } = useQuery<Alerta[]>({
    queryKey: ['alertas'],
    queryFn: async () => (await api.get('/alertas')).data,
    refetchInterval: 30_000,
  });

  return (
    <aside className="panel flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider">ALERTAS ACTIVAS</h2>
        <span className="stat-number text-accent-red text-lg">{data?.length ?? 0}</span>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-border-subtle">
        {isLoading && <div className="p-4 text-xs text-white/50">Cargando…</div>}
        {data?.length === 0 && (
          <div className="p-6 text-center text-xs text-white/40">
            <div className="text-4xl mb-2">✓</div>
            Sin alertas activas
          </div>
        )}
        {data?.map((a) => (
          <div key={a.id} className={`px-4 py-3 hover:bg-bg-surface2/60 transition ${a.nivel === 'rojo' ? 'relative' : ''}`}>
            {a.nivel === 'rojo' && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent-red animate-pulse-red" />
            )}
            <div className="flex items-start justify-between gap-2 mb-1">
              {nivelChip(a.nivel)}
              <span className="text-[10px] font-mono text-white/50">
                {formatDistanceToNow(new Date(a.fecha_inicio), { locale: es, addSuffix: true })}
              </span>
            </div>
            <div className="text-sm font-medium">{a.tipo}</div>
            {a.parque && <div className="text-xs text-white/60">{a.parque.nombre}</div>}
            {a.generada_por && (
              <div className="text-[10px] font-mono text-accent-blue/80 mt-1">
                ↳ {a.generada_por}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
