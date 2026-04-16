import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { EventoClimatico } from '../../types';

export function BottomTimeline() {
  const { data } = useQuery<EventoClimatico[]>({
    queryKey: ['eventos-24h'],
    queryFn: async () => (await api.get('/eventos-climaticos?hours=24')).data,
    refetchInterval: 30_000,
  });

  return (
    <div className="panel h-24 flex items-center overflow-hidden">
      <div className="px-4 border-r border-border-subtle h-full flex flex-col justify-center min-w-[140px]">
        <div className="text-[10px] font-mono text-white/50">TIMELINE 24H</div>
        <div className="stat-number text-accent-blue text-xl">{data?.length ?? 0}</div>
        <div className="text-[10px] font-mono text-white/50">eventos</div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden h-full flex items-center gap-2 px-3">
        {(!data || data.length === 0) && <div className="text-xs text-white/30">Sin eventos recientes</div>}
        {data?.slice(0, 80).map((e) => (
          <div key={e.id} className="shrink-0 panel px-2 py-1.5 min-w-[110px]" title={e.fuente ?? ''}>
            <div className="text-[10px] font-mono uppercase text-accent-blue">{e.tipo}</div>
            <div className="text-xs font-mono">
              {e.intensidad != null ? `${Number(e.intensidad).toFixed(1)} ${e.unidad ?? ''}` : '—'}
            </div>
            <div className="text-[9px] text-white/40">
              {new Date(e.fecha).toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
