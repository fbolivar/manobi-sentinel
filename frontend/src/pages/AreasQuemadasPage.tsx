import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';

interface BurntFeature {
  id: number;
  area_ha: number;
  pre_time: string;
  post_time: string;
  severity: string;
  confidence: number; // 0-100
  product_type: string;
  mean_dnbr: number;
  parque_id: string | null;
  parque_nombre: string | null;
}

interface BurntSummary {
  total_ha: number;
  count: number;
  parques_afectados: number;
  por_severidad: Record<string, number>;
  top_parques: { id: string; nombre: string; ha: number; count: number }[];
  features: BurntFeature[];
}

type Rango = '7d' | '30d' | '90d' | '180d' | 'custom';

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Baja', moderate_low: 'Moderada-baja', moderate: 'Moderada',
  moderate_high: 'Moderada-alta', high: 'Alta', very_high: 'Muy alta', unknown: 'Desconocida',
};
const SEVERITY_COLOR: Record<string, string> = {
  low: 'text-green-600 bg-green-50 border-green-200',
  moderate_low: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  moderate: 'text-amber-600 bg-amber-50 border-amber-200',
  moderate_high: 'text-orange-600 bg-orange-50 border-orange-200',
  high: 'text-red-600 bg-red-50 border-red-200',
  very_high: 'text-rose-700 bg-rose-50 border-rose-200',
  unknown: 'text-txt-muted bg-bg-surface2 border-border-subtle',
};

function rangoAParams(rapido: Rango, desdeCustom: string, hastaCustom: string) {
  const hasta = hastaCustom ? new Date(hastaCustom) : new Date();
  const desde = new Date(hasta);
  if (rapido === 'custom' && desdeCustom) {
    return { desde: new Date(desdeCustom).toISOString(), hasta: hasta.toISOString() };
  }
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
  if (ha >= 10000) return `${(ha / 1000).toFixed(0)}k ha`;
  if (ha >= 1000) return `${(ha / 1000).toFixed(1)}k ha`;
  return `${ha.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ha`;
}

type SortField = 'area_ha' | 'post_time' | 'confidence' | 'severity';

export function AreasQuemadasPage() {
  const [rapido, setRapido] = useState<Rango>('30d');
  const [desdeCustom, setDesdeCustom] = useState('');
  const [hastaCustom, setHastaCustom] = useState('');
  const [sortField, setSortField] = useState<SortField>('post_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filtroPNN, setFiltroPNN] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const { desde, hasta } = useMemo(
    () => rangoAParams(rapido, desdeCustom, hastaCustom),
    [rapido, desdeCustom, hastaCustom],
  );

  const { data, isLoading, error } = useQuery<BurntSummary>({
    queryKey: ['burnt-areas', desde, hasta],
    queryFn: async () => (await api.get('/burnt-areas', { params: { desde, hasta } })).data,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const sorted = useMemo(() => {
    if (!data?.features) return [];
    let list = filtroPNN ? data.features.filter((f) => f.parque_id != null) : data.features;
    return [...list].sort((a, b) => {
      let va: number, vb: number;
      if (sortField === 'area_ha') { va = a.area_ha; vb = b.area_ha; }
      else if (sortField === 'confidence') { va = a.confidence; vb = b.confidence; }
      else if (sortField === 'severity') { va = a.severity.localeCompare(b.severity); return sortDir === 'desc' ? -va : va; }
      else { va = new Date(a.post_time).getTime(); vb = new Date(b.post_time).getTime(); }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [data, sortField, sortDir, filtroPNN]);

  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const maxHa = data?.top_parques[0]?.ha ?? 1;

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); setPage(0); }
  }

  const colSort = (field: SortField, label: string) => (
    <th className="px-3 py-2 text-left font-mono text-txt-muted cursor-pointer hover:text-txt select-none whitespace-nowrap"
      onClick={() => toggleSort(field)}>
      {label} {sortField === field ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4 space-y-3 md:space-y-4">

        {/* Header */}
        <div className="panel px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold tracking-wider">ÁREAS QUEMADAS · ORORATECH</h1>
            <p className="text-[10px] text-txt-muted mt-0.5">
              Detección satelital de áreas quemadas en Colombia · centroide + tiempo de detección
            </p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(['7d', '30d', '90d', '180d'] as const).map((r) => (
              <button key={r} type="button" onClick={() => { setRapido(r); setPage(0); }}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
                  rapido === r ? 'bg-pnn-blue/20 border-pnn-blue text-pnn-blue'
                  : 'border-border-subtle text-txt-muted hover:border-pnn-blue/50 hover:text-txt'
                }`}>{r}</button>
            ))}
            <button type="button" onClick={() => { setRapido('custom'); setPage(0); }}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
                rapido === 'custom' ? 'bg-pnn-blue/20 border-pnn-blue text-pnn-blue'
                : 'border-border-subtle text-txt-muted hover:border-pnn-blue/50 hover:text-txt'
              }`}>
              personalizado
            </button>
          </div>
          {isLoading && <span className="text-[10px] font-mono text-txt-muted animate-pulse">Consultando OroraTech…</span>}
        </div>

        {rapido === 'custom' && (
          <div className="panel px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-txt-muted w-10">Desde</span>
              <input type="date" value={desdeCustom} onChange={(e) => { setDesdeCustom(e.target.value); setPage(0); }}
                title="Fecha inicio" aria-label="Fecha inicio"
                className="bg-bg-surface2 border border-border-subtle rounded px-2 py-1 text-[10px] font-mono text-txt" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-txt-muted w-10">Hasta</span>
              <input type="date" value={hastaCustom} onChange={(e) => { setHastaCustom(e.target.value); setPage(0); }}
                title="Fecha fin" aria-label="Fecha fin"
                className="bg-bg-surface2 border border-border-subtle rounded px-2 py-1 text-[10px] font-mono text-txt" />
            </div>
          </div>
        )}

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="panel p-3 md:p-4 text-center rounded-lg border border-orange-200 bg-orange-50">
            <div className="text-xl md:text-2xl font-mono font-bold text-orange-600">
              {isLoading ? '…' : fmtHa(data?.total_ha ?? 0)}
            </div>
            <div className="text-[10px] font-semibold text-orange-400 uppercase mt-0.5">Ha quemadas</div>
          </div>
          <div className="panel p-3 md:p-4 text-center rounded-lg border border-red-200 bg-red-50">
            <div className="text-xl md:text-2xl font-mono font-bold text-red-600">
              {isLoading ? '…' : (data?.count ?? 0).toLocaleString('es-CO')}
            </div>
            <div className="text-[10px] font-semibold text-red-400 uppercase mt-0.5">Polígonos</div>
          </div>
          <div className="panel p-3 md:p-4 text-center rounded-lg border border-amber-200 bg-amber-50">
            <div className="text-xl md:text-2xl font-mono font-bold text-amber-600">
              {isLoading ? '…' : data?.parques_afectados ?? 0}
            </div>
            <div className="text-[10px] font-semibold text-amber-400 uppercase mt-0.5">PNN afectados</div>
          </div>
          <div className="panel p-3 md:p-4 text-center rounded-lg border border-border-subtle bg-bg-surface2">
            <div className="text-xl md:text-2xl font-mono font-bold text-txt">
              {isLoading ? '…' : (data?.features.filter((f) => f.parque_id == null).length ?? 0).toLocaleString('es-CO')}
            </div>
            <div className="text-[10px] font-semibold text-txt-muted uppercase mt-0.5">Fuera de PNN</div>
          </div>
        </div>

        {/* Severidad chips */}
        {data && Object.keys(data.por_severidad).length > 0 && (
          <div className="panel px-4 py-3 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-semibold text-txt-muted uppercase shrink-0">Severidad:</span>
            {Object.entries(data.por_severidad)
              .sort((a, b) => b[1] - a[1])
              .map(([sev, cnt]) => (
                <span key={sev}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${SEVERITY_COLOR[sev] ?? SEVERITY_COLOR.unknown}`}>
                  {SEVERITY_LABEL[sev] ?? sev} · {cnt}
                </span>
              ))}
          </div>
        )}

        {/* Gráfico top parques */}
        {(data?.top_parques?.length ?? 0) > 0 && (
          <div className="panel p-4">
            <h2 className="text-xs font-bold tracking-wider text-txt-muted uppercase mb-3">
              🔥 Ha quemadas dentro de áreas protegidas (PNN)
            </h2>
            <div className="space-y-2">
              {data!.top_parques.filter((p) => p.id !== '__fuera__').map((p) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="truncate text-txt flex-1 min-w-0">{p.nombre}</span>
                    <span className="font-mono font-bold text-orange-500 ml-3 shrink-0">
                      {fmtHa(p.ha)}
                      <span className="text-txt-muted font-normal ml-1 text-[10px]">({p.count})</span>
                    </span>
                  </div>
                  <div className="h-2 bg-bg-surface2 rounded-full overflow-hidden">
                    {/* eslint-disable-next-line react/forbid-component-props */}
                    <div className="h-full rounded-full bg-orange-500 transition-all"
                      style={{ width: `${(p.ha / maxHa) * 100}%` }} />
                  </div>
                </div>
              ))}
              {data!.top_parques.every((p) => p.id === '__fuera__') && (
                <p className="text-xs text-txt-muted">Ninguna detección intersecta con los polígonos de PNN cargados.</p>
              )}
            </div>
          </div>
        )}

        {/* Tabla */}
        {(data?.count ?? 0) > 0 && (
          <section className="panel overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b border-border-subtle flex flex-wrap items-center gap-2">
              <h2 className="text-xs font-bold tracking-wider text-txt-muted uppercase shrink-0">
                Detalle · <span className="font-mono text-pnn-blue">{sorted.length.toLocaleString('es-CO')}</span> polígonos
              </h2>
              <label className="flex items-center gap-1.5 text-[10px] text-txt-muted cursor-pointer ml-2">
                <input type="checkbox" checked={filtroPNN} onChange={(e) => { setFiltroPNN(e.target.checked); setPage(0); }}
                  className="h-3.5 w-3.5" />
                Solo dentro de PNN
              </label>
              <div className="flex-1" />
              <Link to="/dashboard" className="text-[10px] text-txt-muted hover:text-pnn-blue shrink-0">← Dashboard</Link>
            </div>

            {/* Desktop */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs hidden md:table">
                <thead className="bg-bg-surface/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-mono text-txt-muted">ÁREA PROTEGIDA</th>
                    {colSort('area_ha', 'HECTÁREAS')}
                    {colSort('post_time', 'DETECCIÓN')}
                    <th className="px-3 py-2 text-left font-mono text-txt-muted">PRE-IMAGEN</th>
                    {colSort('severity', 'SEVERIDAD')}
                    {colSort('confidence', 'CONFIANZA')}
                    <th className="px-3 py-2 text-left font-mono text-txt-muted">dNBR</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((f) => (
                    <tr key={f.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                      <td className="px-3 py-2">
                        {f.parque_nombre
                          ? <span className="font-medium text-txt">{f.parque_nombre}</span>
                          : <span className="text-txt-muted italic text-[11px]">Fuera de PNN</span>}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-orange-500">{fmtHa(f.area_ha)}</td>
                      <td className="px-3 py-2 font-mono text-txt-muted">{fmtFecha(f.post_time)}</td>
                      <td className="px-3 py-2 font-mono text-txt-muted">{fmtFecha(f.pre_time)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[f.severity] ?? SEVERITY_COLOR.unknown}`}>
                          {SEVERITY_LABEL[f.severity] ?? f.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <span className={`font-semibold ${f.confidence > 70 ? 'text-red-500' : f.confidence >= 40 ? 'text-amber-500' : 'text-green-600'}`}>
                          {f.confidence}%
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-txt-muted text-[10px]">{f.mean_dnbr.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-border-subtle">
                {paginated.map((f) => (
                  <div key={f.id} className="p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-txt min-w-0 truncate">
                        {f.parque_nombre ?? <span className="italic text-txt-muted text-xs">Fuera de PNN</span>}
                      </div>
                      <span className="font-mono font-bold text-orange-500 shrink-0">{fmtHa(f.area_ha)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[f.severity] ?? SEVERITY_COLOR.unknown}`}>
                        {SEVERITY_LABEL[f.severity] ?? f.severity}
                      </span>
                      <span className={`text-[10px] font-mono font-bold ${f.confidence > 70 ? 'text-red-500' : 'text-amber-500'}`}>
                        {f.confidence}%
                      </span>
                    </div>
                    <div className="text-[10px] text-txt-muted font-mono">{fmtFecha(f.post_time)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-2.5 border-t border-border-subtle flex items-center justify-between shrink-0">
                <button type="button" disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-[10px] px-2 py-1 border border-border-subtle rounded hover:bg-bg-surface2 disabled:opacity-40">
                  ← Anterior
                </button>
                <span className="text-[10px] font-mono text-txt-muted">
                  {page + 1} / {totalPages} · {sorted.length.toLocaleString('es-CO')} registros
                </span>
                <button type="button" disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-[10px] px-2 py-1 border border-border-subtle rounded hover:bg-bg-surface2 disabled:opacity-40">
                  Siguiente →
                </button>
              </div>
            )}
          </section>
        )}

        {!isLoading && !error && data?.count === 0 && (
          <div className="panel p-6 text-center space-y-2">
            <div className="text-3xl opacity-40">🛰️</div>
            <p className="text-sm font-semibold text-txt">Sin detecciones en el período seleccionado</p>
            <p className="text-xs text-txt-muted">{fmtFecha(desde)} → {fmtFecha(hasta)}</p>
          </div>
        )}

        {error && (
          <div className="panel p-4 text-xs text-accent-red bg-accent-red/10 rounded">
            Error consultando OroraTech. Revisa la conexión o el API key.
          </div>
        )}
      </main>
    </div>
  );
}
