import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import type { Parque } from '../types';

interface Reporte {
  id: string;
  tipo: string;
  formato: 'pdf' | 'xlsx' | 'csv';
  ruta_minio: string | null;
  creado_en: string;
  parametros: {
    desde?: string;
    hasta?: string;
    niveles?: string[];
    parque_id?: string;
  };
}

const TIPOS_REPORTE = [
  'Resumen de alertas',
  'Reporte por parque',
  'Reporte de incendios',
  'Reporte de inundaciones',
  'Reporte semanal operativo',
];

const FORMATO_ICON: Record<string, string> = { pdf: '📄', xlsx: '📊', csv: '📋' };

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 16);
}

function defaultHasta() {
  return new Date().toISOString().slice(0, 16);
}

function formatParams(p: Reporte['parametros'], parques?: Parque[]): string {
  const parts: string[] = [];
  if (p.desde) parts.push(`desde ${new Date(p.desde).toLocaleDateString('es-CO')}`);
  if (p.hasta) parts.push(`hasta ${new Date(p.hasta).toLocaleDateString('es-CO')}`);
  if (p.parque_id) {
    const nombre = parques?.find((q) => q.id === p.parque_id)?.nombre;
    if (nombre) parts.push(nombre);
  }
  if (p.niveles?.length) parts.push(p.niveles.join(', '));
  return parts.length ? parts.join(' · ') : 'Sin filtros';
}

function friendlyFilename(r: Reporte): string {
  const fecha = new Date(r.creado_en).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return `${r.tipo} ${fecha}.${r.formato}`;
}

export function ReportesPage() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState(TIPOS_REPORTE[0]);
  const [formato, setFormato] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [niveles, setNiveles] = useState<string[]>(['rojo', 'amarillo']);
  const [parqueId, setParqueId] = useState('');
  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(defaultHasta);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const parques = useQuery<Parque[]>({
    queryKey: ['parques-list'],
    queryFn: async () => (await api.get('/parques')).data,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery<Reporte[]>({
    queryKey: ['reportes'],
    queryFn: async () => (await api.get('/reportes')).data,
    refetchInterval: 30_000,
  });

  const gen = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { tipo, formato, niveles };
      if (desde) body.desde = new Date(desde).toISOString();
      if (hasta) body.hasta = new Date(hasta).toISOString();
      if (parqueId) body.parque_id = parqueId;
      return (await api.post('/reportes', body)).data;
    },
    onSuccess: () => {
      setMsg({ text: 'Reporte generado correctamente', ok: true });
      qc.invalidateQueries({ queryKey: ['reportes'] });
      setTimeout(() => setMsg(null), 4000);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setMsg({ text: `Error: ${e.response?.data?.message ?? 'fallo en generación'}`, ok: false }),
  });

  async function download(r: Reporte) {
    try {
      const resp = await api.get(`/reportes/${r.id}/download`, { responseType: 'blob' });
      const ext = r.formato;
      const blob = new Blob([resp.data], {
        type: ext === 'pdf' ? 'application/pdf'
          : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = friendlyFilename(r);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMsg({ text: 'Error al descargar el archivo', ok: false });
    }
  }

  const eliminar = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/reportes/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reportes'] }),
  });

  const toggle = (n: string) =>
    setNiveles((s) => s.includes(n) ? s.filter((x) => x !== n) : [...s, n]);

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[340px_1fr] pb-20 md:pb-4">

        {/* Panel de generación */}
        <aside className="panel p-4 space-y-3 h-fit">
          <h2 className="text-sm font-bold tracking-wider">GENERAR REPORTE</h2>

          <label className="block">
            <span className="text-xs font-mono text-txt-muted">TIPO</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              title="Tipo de reporte" aria-label="Tipo de reporte"
              className="mt-1 w-full input-field !py-1.5 !text-xs">
              {TIPOS_REPORTE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-mono text-txt-muted">FORMATO</span>
            <select value={formato} onChange={(e) => setFormato(e.target.value as 'pdf' | 'xlsx' | 'csv')}
              title="Formato" aria-label="Formato"
              className="mt-1 w-full input-field !py-1.5 !text-xs">
              <option value="pdf">📄 PDF</option>
              <option value="xlsx">📊 Excel (XLSX)</option>
              <option value="csv">📋 CSV</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-mono text-txt-muted">PARQUE</span>
            <select value={parqueId} onChange={(e) => setParqueId(e.target.value)}
              title="Parque" aria-label="Parque"
              className="mt-1 w-full input-field !py-1.5 !text-xs">
              <option value="">— Todos los parques —</option>
              {parques.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>

          <div>
            <div className="text-xs font-mono text-txt-muted mb-1.5">NIVELES</div>
            <div className="flex gap-2">
              {(['rojo', 'amarillo', 'verde'] as const).map((n) => (
                <label key={n} className={`cursor-pointer chip chip-${n === 'rojo' ? 'rojo' : n === 'amarillo' ? 'amarillo' : 'verde'} ${niveles.includes(n) ? '' : 'opacity-35'}`}>
                  <input type="checkbox" className="hidden" checked={niveles.includes(n)} onChange={() => toggle(n)} />
                  {n.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="block">
              <span className="text-xs font-mono text-txt-muted">DESDE</span>
              <input type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)}
                className="mt-1 w-full input-field !py-1.5 !text-xs" />
            </label>
            <label className="block">
              <span className="text-xs font-mono text-txt-muted">HASTA</span>
              <input type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)}
                className="mt-1 w-full input-field !py-1.5 !text-xs" />
            </label>
          </div>

          <button type="button" onClick={() => gen.mutate()} disabled={gen.isPending || niveles.length === 0}
            className="w-full bg-pnn-green text-bg-base font-bold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-50 transition text-sm">
            {gen.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-bg-base/30 border-t-bg-base rounded-full animate-spin" />
                Generando…
              </span>
            ) : 'GENERAR'}
          </button>

          {msg && (
            <div className={`text-xs px-3 py-2 rounded border ${
              msg.ok
                ? 'border-pnn-green/30 bg-pnn-green/10 text-pnn-green-dark'
                : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
            }`}>
              {msg.text}
            </div>
          )}

          <Link to="/dashboard" className="block text-xs text-txt-muted hover:text-pnn-blue">← Volver al dashboard</Link>
        </aside>

        {/* Lista de reportes */}
        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider">REPORTES GENERADOS</h2>
            <span className="text-xs font-mono text-txt-muted">{data?.length ?? 0} total</span>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">TIPO</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">FMT</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted hidden md:table-cell">PARÁMETROS</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">FECHA</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="text-center py-6 text-txt-light">Cargando…</td></tr>
                )}
                {!isLoading && data?.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-txt-light">Sin reportes aún. Genera el primero.</td></tr>
                )}
                {data?.map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2 max-w-[140px]">
                      <div className="font-medium text-txt truncate">{r.tipo}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm" title={r.formato.toUpperCase()}>
                        {FORMATO_ICON[r.formato]}
                      </span>
                      <span className="ml-1 text-[10px] font-mono text-txt-muted">{r.formato.toUpperCase()}</span>
                    </td>
                    <td className="px-3 py-2 text-txt-muted hidden md:table-cell max-w-[220px]">
                      <span className="truncate block text-[10px] font-mono" title={formatParams(r.parametros, parques.data)}>
                        {formatParams(r.parametros, parques.data)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-txt-muted whitespace-nowrap">
                      {new Date(r.creado_en).toLocaleString('es-CO', {
                        timeZone: 'America/Bogota',
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        {r.ruta_minio && (
                          <button type="button" onClick={() => download(r)}
                            className="text-xs px-2.5 py-1 border border-pnn-blue text-pnn-blue rounded-lg hover:bg-pnn-blue/10 transition whitespace-nowrap">
                            ↓ Descargar
                          </button>
                        )}
                        <button type="button"
                          onClick={() => { if (window.confirm('¿Eliminar este reporte?')) eliminar.mutate(r.id); }}
                          className="text-xs px-2.5 py-1 border border-accent-red/40 text-accent-red rounded-lg hover:bg-accent-red/10 transition">
                          ✕
                        </button>
                      </div>
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
