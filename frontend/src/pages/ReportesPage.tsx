import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';

interface Reporte {
  id: string; tipo: string; formato: 'pdf' | 'xlsx' | 'csv';
  ruta_minio: string | null; creado_en: string;
  parametros: Record<string, unknown>;
}

export function ReportesPage() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState('Resumen de alertas');
  const [formato, setFormato] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [niveles, setNiveles] = useState<string[]>(['rojo', 'amarillo']);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

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
      return (await api.post('/reportes', body)).data;
    },
    onSuccess: () => {
      setMsg('Reporte generado correctamente');
      qc.invalidateQueries({ queryKey: ['reportes'] });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setMsg(`Error: ${e.response?.data?.message ?? 'fallo generación'}`),
  });

  async function download(r: Reporte) {
    const resp = await api.get(`/reportes/${r.id}/download`, { responseType: 'blob' });
    const ext = r.formato ?? 'pdf';
    const filename = r.ruta_minio ?? `reporte_${r.id.slice(0, 8)}.${ext}`;
    const blob = new Blob([resp.data], {
      type: ext === 'pdf' ? 'application/pdf'
        : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const toggle = (n: string) =>
    setNiveles((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-4 grid gap-4 grid-cols-1 md:grid-cols-[360px_1fr]">
        <aside className="panel p-4 space-y-3 h-fit">
          <h2 className="text-sm font-bold tracking-wider">GENERAR REPORTE</h2>
          <label className="block">
            <span className="text-xs font-mono text-white/50">TIPO</span>
            <input value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-white/50">FORMATO</span>
            <select value={formato} onChange={(e) => setFormato(e.target.value as 'pdf' | 'xlsx' | 'csv')}
              title="Formato" aria-label="Formato"
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono">
              <option value="pdf">PDF</option><option value="xlsx">XLSX</option><option value="csv">CSV</option>
            </select>
          </label>
          <div>
            <div className="text-xs font-mono text-white/50 mb-1">NIVELES</div>
            <div className="flex gap-2">
              {(['rojo', 'amarillo', 'verde'] as const).map((n) => (
                <label key={n} className={`cursor-pointer chip chip-${n === 'rojo' ? 'rojo' : n === 'amarillo' ? 'amarillo' : 'verde'} ${niveles.includes(n) ? '' : 'opacity-40'}`}>
                  <input type="checkbox" className="hidden" checked={niveles.includes(n)} onChange={() => toggle(n)} />
                  {n.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-mono text-white/50">DESDE</span>
              <input type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)}
                className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-2 py-1.5 font-mono text-xs" />
            </label>
            <label className="block">
              <span className="text-xs font-mono text-white/50">HASTA</span>
              <input type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)}
                className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-2 py-1.5 font-mono text-xs" />
            </label>
          </div>
          <button onClick={() => gen.mutate()} disabled={gen.isPending}
            className="w-full bg-accent-green text-bg font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50 transition">
            {gen.isPending ? 'Generando…' : 'GENERAR'}
          </button>
          {msg && <div className="text-xs text-accent-blue">{msg}</div>}
          <Link to="/dashboard" className="block text-xs text-white/50 hover:text-accent-blue">← Volver al dashboard</Link>
        </aside>

        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider">REPORTES GENERADOS</h2>
            <span className="text-xs font-mono text-white/50">{data?.length ?? 0} total</span>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-white/50">TIPO</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">FORMATO</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">FECHA</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">ARCHIVO</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={5} className="text-center py-6 text-white/40">Cargando…</td></tr>}
                {data?.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-white/40">Sin reportes aún</td></tr>}
                {data?.map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2">{r.tipo}</td>
                    <td className="px-3 py-2"><span className="chip chip-verde">{r.formato.toUpperCase()}</span></td>
                    <td className="px-3 py-2 font-mono text-white/60">{new Date(r.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
                    <td className="px-3 py-2 font-mono text-white/40 truncate max-w-xs">{r.ruta_minio ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {r.ruta_minio && (
                        <button onClick={() => download(r)}
                          className="text-xs px-3 py-1 border border-accent-blue text-accent-blue rounded hover:bg-accent-blue/10">
                          Descargar
                        </button>
                      )}
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
