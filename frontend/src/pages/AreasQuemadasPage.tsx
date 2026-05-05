import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';

interface BurntFeature {
  id: string | number;
  area_ha: number;
  start_time: string;
  end_time: string | null;
  satellite: string;
  confidence: number | null;
  parque_id: string | null;
  parque_nombre: string | null;
}

interface BurntSummary {
  total_ha: number;
  count: number;
  parques_afectados: number;
  top_parques: { id: string; nombre: string; ha: number; count: number }[];
  features: BurntFeature[];
}

type RangoRapido = '7d' | '30d' | '90d' | '180d' | 'custom';

function rangoFechas(rapido: RangoRapido): { desde: string; hasta: string } {
  const hasta = new Date();
  const desde = new Date();
  const dias = rapido === '7d' ? 7 : rapido === '30d' ? 30 : rapido === '90d' ? 90 : 180;
  desde.setDate(desde.getDate() - dias);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtHa(ha: number) {
  if (ha >= 1000) return `${(ha / 1000).toFixed(1)}k ha`;
  return `${ha.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ha`;
}

export function AreasQuemadasPage() {
  const [rapido, setRapido] = useState<RangoRapido>('30d');
  const [desdeCustom, setDesdeCustom] = useState('');
  const [hastaCustom, setHastaCustom] = useState('');
  const [sortField, setSortField] = useState<'area_ha' | 'start_time'>('start_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { desde, hasta } = useMemo(() => {
    if (rapido === 'custom' && (desdeCustom || hastaCustom)) {
      return {
        desde: desdeCustom ? new Date(desdeCustom).toISOString() : rangoFechas('30d').desde,
        hasta: hastaCustom ? new Date(hastaCustom).toISOString() : new Date().toISOString(),
      };
    }
    return rapido === 'custom' ? rangoFechas('30d') : rangoFechas(rapido);
  }, [rapido, desdeCustom, hastaCustom]);

  const { data, isLoading, error } = useQuery<BurntSummary>({
    queryKey: ['burnt-areas', desde, hasta],
    queryFn: async () => (await api.get('/burnt-areas', { params: { desde, hasta } })).data,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const sorted = useMemo(() => {
    if (!data?.features) return [];
    return [...data.features].sort((a, b) => {
      const va = sortField === 'area_ha' ? a.area_ha : new Date(a.start_time).getTime();
      const vb = sortField === 'area_ha' ? b.area_ha : new Date(b.start_time).getTime();
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [data, sortField, sortDir]);

  const maxHa = data?.top_parques[0]?.ha ?? 1;

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  }

  const sinDatos = !isLoading && !error && data?.count === 0;

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4 space-y-3 md:space-y-4">

        {/* Header + filtros */}
        <div className="panel px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold tracking-wider">ÁREAS QUEMADAS · ORORATECH</h1>
            <p className="text-[10px] text-txt-muted mt-0.5">
              Detección satelital de áreas quemadas en Colombia · datos OroraTech
            </p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(['7d', '30d', '90d', '180d'] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRapido(r)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
                  rapido === r
                    ? 'bg-pnn-blue/20 border-pnn-blue text-pnn-blue'
                    : 'border-border-subtle text-txt-muted hover:border-pnn-blue/50 hover:text-txt'
                }`}>
                {r}
              </button>
            ))}
            <button type="button" onClick={() => setRapido('custom')}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
                rapido === 'custom'
                  ? 'bg-pnn-blue/20 border-pnn-blue text-pnn-blue'
                  : 'border-border-subtle text-txt-muted hover:border-pnn-blue/50 hover:text-txt'
              }`}>
              personalizado
            </button>
          </div>
          {isLoading && <span className="text-[10px] font-mono text-txt-muted">Consultando OroraTech…</span>}
        </div>

        {/* Selector fechas custom */}
        {rapido === 'custom' && (
          <div className="panel px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-txt-muted w-10 shrink-0">Desde</span>
              <input type="date" value={desdeCustom.slice(0, 10)}
                onChange={(e) => setDesdeCustom(e.target.value)}
                title="Fecha inicio" aria-label="Fecha inicio"
                className="bg-bg-surface2 border border-border-subtle rounded px-2 py-1 text-[10px] font-mono text-txt" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-txt-muted w-10 shrink-0">Hasta</span>
              <input type="date" value={hastaCustom.slice(0, 10)}
                onChange={(e) => setHastaCustom(e.target.value)}
                title="Fecha fin" aria-label="Fecha fin"
                className="bg-bg-surface2 border border-border-subtle rounded px-2 py-1 text-[10px] font-mono text-txt" />
            </div>
          </div>
        )}

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <div className="panel p-3 md:p-4 text-center rounded-lg border border-orange-200 bg-orange-50">
            <div className="text-2xl md:text-3xl font-mono font-bold text-orange-600">
              {isLoading ? '…' : fmtHa(data?.total_ha ?? 0)}
            </div>
            <div className="text-[10px] font-semibold text-orange-400 uppercase mt-0.5">Ha quemadas</div>
          </div>
          <div className="panel p-3 md:p-4 text-center rounded-lg border border-red-200 bg-red-50">
            <div className="text-2xl md:text-3xl font-mono font-bold text-red-600">
              {isLoading ? '…' : data?.count ?? 0}
            </div>
            <div className="text-[10px] font-semibold text-red-400 uppercase mt-0.5">Eventos</div>
          </div>
          <div className="panel p-3 md:p-4 text-center rounded-lg border border-amber-200 bg-amber-50">
            <div className="text-2xl md:text-3xl font-mono font-bold text-amber-600">
              {isLoading ? '…' : data?.parques_afectados ?? 0}
            </div>
            <div className="text-[10px] font-semibold text-amber-400 uppercase mt-0.5">Áreas afectadas</div>
          </div>
        </div>

        {/* Estado sin datos */}
        {sinDatos && (
          <div className="panel p-6 text-center space-y-2">
            <div className="text-3xl opacity-40">🛰️</div>
            <p className="text-sm font-semibold text-txt">Sin detecciones en el período seleccionado</p>
            <p className="text-xs text-txt-muted max-w-md mx-auto">
              OroraTech no reportó áreas quemadas en Colombia para este rango de fechas.
              La función de áreas quemadas puede requerir habilitación en el plan de suscripción.
              Contactar a <span className="font-mono text-pnn-blue">support@ororatech.com</span> para verificar.
            </p>
            <p className="text-[10px] text-txt-light font-mono">
              Rango consultado: {fmtFecha(desde)} → {fmtFecha(hasta)}
            </p>
          </div>
        )}

        {/* Gráfico de barras: Ha por área/parque */}
        {(data?.top_parques?.length ?? 0) > 0 && (
          <div className="panel p-4">
            <h2 className="text-xs font-bold tracking-wider text-txt-muted uppercase mb-3">
              🔥 Hectáreas quemadas por área protegida
            </h2>
            <div className="space-y-2">
              {data!.top_parques.map((p) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="truncate text-txt flex-1 min-w-0">{p.nombre}</span>
                    <span className="font-mono font-bold text-orange-500 ml-3 shrink-0">
                      {fmtHa(p.ha)}
                      <span className="text-txt-muted font-normal ml-1">({p.count} ev.)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-bg-surface2 rounded-full overflow-hidden">
                    {/* eslint-disable-next-line react/forbid-component-props -- ancho dinámico no expresable en Tailwind estático */}
                    <div className="h-full rounded-full bg-orange-500 transition-all"
                      style={{ width: `${(p.ha / maxHa) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla de eventos */}
        {(data?.count ?? 0) > 0 && (
          <section className="panel overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-wider text-txt-muted uppercase">
                Detalle de eventos
                <span className="ml-2 font-mono text-pnn-blue">{data!.count}</span>
              </h2>
              <Link to="/dashboard" className="text-[10px] text-txt-muted hover:text-pnn-blue">← Dashboard</Link>
            </div>

            {/* Desktop table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs hidden md:table">
                <thead className="bg-bg-surface/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-mono text-txt-muted">ÁREA PROTEGIDA</th>
                    <th className="px-3 py-2 text-left font-mono text-txt-muted cursor-pointer hover:text-txt select-none"
                      onClick={() => toggleSort('area_ha')}>
                      HECTÁREAS {sortField === 'area_ha' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th className="px-3 py-2 text-left font-mono text-txt-muted cursor-pointer hover:text-txt select-none"
                      onClick={() => toggleSort('start_time')}>
                      FECHA INICIO {sortField === 'start_time' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th className="px-3 py-2 text-left font-mono text-txt-muted">FECHA FIN</th>
                    <th className="px-3 py-2 text-left font-mono text-txt-muted">SATÉLITE</th>
                    <th className="px-3 py-2 text-left font-mono text-txt-muted">CONF.</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((f) => (
                    <tr key={f.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                      <td className="px-3 py-2 text-txt">
                        {f.parque_nombre
                          ? <span className="font-medium">{f.parque_nombre}</span>
                          : <span className="text-txt-muted italic">Fuera de área protegida</span>}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-orange-500">{fmtHa(f.area_ha)}</td>
                      <td className="px-3 py-2 font-mono text-txt-muted">{f.start_time ? fmtFecha(f.start_time) : '—'}</td>
                      <td className="px-3 py-2 font-mono text-txt-muted">{f.end_time ? fmtFecha(f.end_time) : '—'}</td>
                      <td className="px-3 py-2 text-txt-muted">{f.satellite}</td>
                      <td className="px-3 py-2 font-mono">
                        {f.confidence != null
                          ? <span className={`font-semibold ${f.confidence > 70 ? 'text-red-500' : f.confidence >= 40 ? 'text-amber-500' : 'text-green-500'}`}>
                              {f.confidence}%
                            </span>
                          : <span className="text-txt-light">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border-subtle">
                {sorted.map((f) => (
                  <div key={f.id} className="p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm text-txt min-w-0">
                        {f.parque_nombre ?? <span className="italic text-txt-muted">Fuera de área</span>}
                      </div>
                      <span className="font-mono font-bold text-orange-500 shrink-0">{fmtHa(f.area_ha)}</span>
                    </div>
                    <div className="text-[10px] text-txt-muted font-mono">
                      {f.start_time ? fmtFecha(f.start_time) : '—'}
                      {f.end_time ? ` → ${fmtFecha(f.end_time)}` : ''}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-txt-muted">
                      <span>{f.satellite}</span>
                      {f.confidence != null && (
                        <span className={`font-mono font-semibold ${f.confidence > 70 ? 'text-red-500' : 'text-amber-500'}`}>
                          {f.confidence}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
