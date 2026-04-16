import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '../../lib/api';
import { useMapStore } from '../../stores/map.store';
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

  const focusOnParque = useMapStore((s) => s.focusOnParque);

  return (
    <aside className="panel flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-txt tracking-wide">Alertas activas</h2>
        <span className="text-lg font-bold text-accent-red">{data?.length ?? 0}</span>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-border-subtle overscroll-contain">
        {isLoading && <div className="p-4 text-xs text-txt-muted">Cargando…</div>}
        {data?.length === 0 && (
          <div className="p-6 text-center text-xs text-txt-light">
            <div className="text-3xl mb-2 opacity-40">✓</div>
            Sin alertas activas
          </div>
        )}
        {data?.map((a) => (
          <button key={a.id} type="button"
            onClick={() => a.parque_id && focusOnParque(a.parque_id)}
            className={`w-full text-left px-4 py-3 hover:bg-bg-surface2 active:bg-bg transition ${
              a.nivel === 'rojo' ? 'relative border-l-[3px] border-l-accent-red' : ''
            } ${a.parque_id ? 'cursor-pointer' : 'cursor-default'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              {nivelChip(a.nivel)}
              <span className="text-[10px] text-txt-light">
                {formatDistanceToNow(new Date(a.fecha_inicio), { locale: es, addSuffix: true })}
              </span>
            </div>
            <div className="text-sm font-medium text-txt">{a.tipo}</div>
            {a.parque && (
              <div className="text-xs text-txt-muted flex items-center gap-1 mt-0.5">
                <span className="text-pnn-green">📍</span> {a.parque.nombre}
              </div>
            )}
            {a.descripcion && (
              <div className="text-[10px] text-txt-light mt-1 line-clamp-2">{a.descripcion}</div>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
