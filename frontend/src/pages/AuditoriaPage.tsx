import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import { useAuthStore } from '../stores/auth.store';

interface AuditoriaLog {
  id: string;
  usuario_id: string | null;
  accion: string;
  fecha: string;
  ip: string | null;
  resultado: 'exito' | 'error';
  detalle: Record<string, unknown> | null;
}

interface AuditoriaResponse {
  data: AuditoriaLog[];
  total: number;
}

const PAGE_SIZE = 50;

export function AuditoriaPage() {
  const me = useAuthStore((s) => s.user);
  const [resultado, setResultado] = useState('');
  const [page, setPage] = useState(0);

  const query = useQuery<AuditoriaResponse>({
    queryKey: ['auditoria', resultado, page],
    queryFn: async () => (await api.get('/auditoria', {
      params: {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(resultado && { resultado }),
      },
    })).data,
    staleTime: 30_000,
  });

  if (me?.rol !== 'admin') {
    return (
      <div className="h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 grid place-items-center pb-20 md:pb-0">
          <div className="panel p-6 text-center">
            <div className="text-accent-red text-sm font-bold">Acceso restringido</div>
            <div className="text-xs text-txt-muted mt-1">Solo administradores pueden ver el registro de auditoría.</div>
            <Link to="/dashboard" className="inline-block mt-3 text-xs text-pnn-blue hover:underline">← Volver</Link>
          </div>
        </main>
      </div>
    );
  }

  const logs = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4 pb-20 md:pb-4">

        {/* Filters */}
        <div className="flex flex-wrap gap-2 md:gap-3 items-end">
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">RESULTADO</span>
            <select value={resultado} onChange={(e) => { setResultado(e.target.value); setPage(0); }}
              title="Resultado" aria-label="Resultado"
              className="mt-1 block input-field !py-1.5 !text-xs w-full md:w-40">
              <option value="">— Todos —</option>
              <option value="exito">Éxito</option>
              <option value="error">Error</option>
            </select>
          </label>
          <div className="text-xs text-txt-muted font-mono self-end pb-1.5">
            {total.toLocaleString('es-CO')} registros totales
          </div>
          <Link to="/dashboard" className="text-xs text-txt-muted hover:text-pnn-blue ml-auto self-end pb-1.5">
            ← Dashboard
          </Link>
        </div>

        {/* Table */}
        <section className="panel overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider">REGISTRO DE AUDITORÍA</h2>
            {query.isFetching && !query.isLoading && (
              <span className="text-[10px] font-mono text-txt-muted animate-pulse">actualizando…</span>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {/* Desktop */}
            <table className="w-full text-xs hidden md:table">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">FECHA</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">ACCIÓN</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">RESULTADO</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">IP</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">DETALLE</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading && (
                  <tr><td colSpan={5} className="text-center py-6 text-txt-light">Cargando…</td></tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2 font-mono text-txt-muted whitespace-nowrap">
                      {new Date(log.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={log.accion}>{log.accion}</td>
                    <td className="px-3 py-2">
                      <span className={`chip ${log.resultado === 'exito' ? 'chip-verde' : 'chip-rojo'}`}>
                        {log.resultado}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-txt-muted">{log.ip ?? '—'}</td>
                    <td className="px-3 py-2 max-w-[260px] truncate text-txt-muted" title={log.detalle ? JSON.stringify(log.detalle) : ''}>
                      {log.detalle ? JSON.stringify(log.detalle) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border-subtle">
              {query.isLoading && <div className="p-4 text-xs text-txt-light">Cargando…</div>}
              {logs.map((log) => (
                <div key={log.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-txt-muted">
                      {new Date(log.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                    </span>
                    <span className={`chip ${log.resultado === 'exito' ? 'chip-verde' : 'chip-rojo'}`}>
                      {log.resultado}
                    </span>
                  </div>
                  <div className="text-xs font-medium truncate">{log.accion}</div>
                  {log.ip && <div className="text-[11px] font-mono text-txt-muted">IP: {log.ip}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
              <button type="button" disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="text-xs px-3 py-1.5 border border-border-subtle rounded hover:bg-bg-surface2 disabled:opacity-30">
                ← Anterior
              </button>
              <span className="text-xs font-mono text-txt-muted">
                Pág. {page + 1} / {totalPages}
              </span>
              <button type="button" disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="text-xs px-3 py-1.5 border border-border-subtle rounded hover:bg-bg-surface2 disabled:opacity-30">
                Siguiente →
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
