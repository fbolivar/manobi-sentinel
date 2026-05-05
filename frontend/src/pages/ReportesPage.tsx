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
  parametros: Record<string, unknown>;
}

interface EntradaCronologica {
  fecha: string;
  focos?: number;
  texto: string;
}

const TIPOS_REPORTE = [
  'Resumen de alertas',
  'Reporte por parque',
  'Reporte de incendios',
  'Reporte de inundaciones',
  'Reporte semanal operativo',
];

const FORMATO_ICON: Record<string, string> = { pdf: '📄', xlsx: '📊', csv: '📋' };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function defaultDesde() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 16);
}
function defaultHasta() { return new Date().toISOString().slice(0, 16); }

function formatParams(p: Record<string, unknown>, parques?: Parque[]): string {
  const parts: string[] = [];
  if (p.desde) parts.push(`desde ${new Date(p.desde as string).toLocaleDateString('es-CO')}`);
  if (p.hasta) parts.push(`hasta ${new Date(p.hasta as string).toLocaleDateString('es-CO')}`);
  if (p.parque_id) {
    const nombre = parques?.find((q) => q.id === p.parque_id)?.nombre;
    if (nombre) parts.push(nombre);
  }
  if (p.area_protegida) parts.push(p.area_protegida as string);
  if ((p.niveles as string[] | undefined)?.length) parts.push((p.niveles as string[]).join(', '));
  return parts.length ? parts.join(' · ') : 'Sin filtros';
}

function friendlyFilename(r: Reporte): string {
  const fecha = new Date(r.creado_en).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return `${r.tipo} ${fecha}.${r.formato}`;
}

/* ──────────────────── Formulario general ──────────────────── */
function FormGeneral({
  parques, onSubmit, isPending,
}: {
  parques?: Parque[];
  onSubmit: (body: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [tipo, setTipo] = useState(TIPOS_REPORTE[0]);
  const [formato, setFormato] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [niveles, setNiveles] = useState<string[]>(['rojo', 'amarillo']);
  const [parqueId, setParqueId] = useState('');
  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(defaultHasta);

  const toggle = (n: string) =>
    setNiveles((s) => s.includes(n) ? s.filter((x) => x !== n) : [...s, n]);

  function handleSubmit() {
    const body: Record<string, unknown> = { tipo, formato, niveles };
    if (desde) body.desde = new Date(desde).toISOString();
    if (hasta) body.hasta = new Date(hasta).toISOString();
    if (parqueId) body.parque_id = parqueId;
    onSubmit(body);
  }

  return (
    <div className="space-y-3">
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
          {parques?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>

      <div>
        <div className="text-xs font-mono text-txt-muted mb-1.5">NIVELES</div>
        <div className="flex gap-2">
          {(['rojo', 'amarillo', 'verde'] as const).map((n) => (
            <label key={n} className={`cursor-pointer chip chip-${n === 'rojo' ? 'rojo' : n === 'amarillo' ? 'amarillo' : 'verde'} ${niveles.includes(n) ? '' : 'opacity-35'}`}>
              <input type="checkbox" className="hidden" title={`Nivel ${n}`} checked={niveles.includes(n)} onChange={() => toggle(n)} />
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

      <button type="button" onClick={handleSubmit} disabled={isPending || niveles.length === 0}
        className="w-full bg-pnn-green text-bg-base font-bold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-50 transition text-sm">
        {isPending ? <Spinner /> : 'GENERAR'}
      </button>
    </div>
  );
}

/* ──────────────────── Lista de entradas cronológicas ──────────────────── */
function ListaEntradas({
  label, items, setItems, conFocos = false,
}: {
  label: string;
  items: EntradaCronologica[];
  setItems: (v: EntradaCronologica[]) => void;
  conFocos?: boolean;
}) {
  function add() {
    setItems([...items, { fecha: todayISO(), texto: '', focos: undefined }]);
  }
  function update(idx: number, field: keyof EntradaCronologica, val: string | number | undefined) {
    const next = items.map((e, i) => i === idx ? { ...e, [field]: val } : e);
    setItems(next);
  }
  function remove(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-txt-muted">{label}</span>
        <button type="button" onClick={add}
          className="text-[10px] px-2 py-0.5 border border-pnn-green text-pnn-green rounded hover:bg-pnn-green/10 transition">
          + Agregar
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-txt-muted italic">Sin entradas. Usa "+ Agregar".</p>
      )}
      {items.map((e, idx) => (
        <div key={idx} className="bg-bg-surface2 rounded-lg p-2.5 space-y-1.5">
          <div className="flex gap-2">
            <input type="date" value={e.fecha}
              onChange={(ev) => update(idx, 'fecha', ev.target.value)}
              className="input-field !py-1 !text-xs flex-1" />
            {conFocos && (
              <input type="number" min={0} placeholder="Focos"
                value={e.focos ?? ''}
                onChange={(ev) => update(idx, 'focos', ev.target.value ? Number(ev.target.value) : undefined)}
                className="input-field !py-1 !text-xs w-20" />
            )}
            <button type="button" onClick={() => remove(idx)}
              className="text-accent-red hover:bg-accent-red/10 rounded px-1.5 text-sm transition">✕</button>
          </div>
          <textarea value={e.texto} onChange={(ev) => update(idx, 'texto', ev.target.value)}
            placeholder="Descripción..." rows={2}
            className="w-full input-field !py-1 !text-xs resize-y" />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────── Formulario Incendio Forestal ──────────────────── */
function FormIncendio({
  parques, onSubmit, isPending,
}: {
  parques?: Parque[];
  onSubmit: (body: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [numSeguimiento, setNumSeguimiento] = useState(1);
  const [fechaReporte, setFechaReporte] = useState(todayISO);
  const [areaProtegida, setAreaProtegida] = useState('');
  const [municipioDpto, setMunicipioDpto] = useState('');
  const [estadoActual, setEstadoActual] = useState('Incendio activo');
  const [elaboradoPor, setElaboradoPor] = useState('Oficina de Gestión del Riesgo');
  const [coberturaHa, setCoberturaHa] = useState('');
  const [coberturaDesc, setCoberturaDesc] = useState('');
  const [reportesCampo, setReportesCampo] = useState<EntradaCronologica[]>([]);
  const [notas, setNotas] = useState('');
  const [monitoreo, setMonitoreo] = useState<EntradaCronologica[]>([]);
  const [intervenciones, setIntervenciones] = useState<EntradaCronologica[]>([]);
  const [fauna, setFauna] = useState('');

  // Si selecciona parque, pre-llenar el campo area_protegida
  const [parqueId, setParqueId] = useState('');
  function handleParque(id: string) {
    setParqueId(id);
    const p = parques?.find((q) => q.id === id);
    if (p && !areaProtegida) setAreaProtegida(p.nombre);
  }

  function handleSubmit() {
    onSubmit({
      numero_seguimiento: numSeguimiento,
      fecha_reporte: fechaReporte,
      area_protegida: areaProtegida,
      municipio_departamento: municipioDpto,
      estado_actual: estadoActual,
      elaborado_por: elaboradoPor,
      cobertura_ha: coberturaHa ? Number(coberturaHa) : undefined,
      cobertura_descripcion: coberturaDesc,
      reportes_campo: reportesCampo,
      notas: notas || undefined,
      monitoreo_satelital: monitoreo,
      intervenciones,
      fauna_afectada: fauna || undefined,
      parque_id: parqueId || undefined,
    });
  }

  const ESTADOS = [
    'Incendio activo', 'Incendio en control', 'Incendio controlado',
    'Incendio liquidado', 'En monitoreo post-incendio',
  ];

  return (
    <div className="space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto pr-0.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-mono text-txt-muted">N° SEGUIMIENTO</span>
          <input type="number" min={1} value={numSeguimiento}
            onChange={(e) => setNumSeguimiento(Number(e.target.value))}
            className="mt-1 w-full input-field !py-1.5 !text-xs" />
        </label>
        <label className="block">
          <span className="text-xs font-mono text-txt-muted">FECHA REPORTE</span>
          <input type="date" value={fechaReporte}
            onChange={(e) => setFechaReporte(e.target.value)}
            className="mt-1 w-full input-field !py-1.5 !text-xs" />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">PARQUE (opcional)</span>
        <select value={parqueId} onChange={(e) => handleParque(e.target.value)}
          title="Parque" aria-label="Parque"
          className="mt-1 w-full input-field !py-1.5 !text-xs">
          <option value="">— Seleccionar parque —</option>
          {parques?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">ÁREA PROTEGIDA</span>
        <input type="text" value={areaProtegida}
          onChange={(e) => setAreaProtegida(e.target.value)}
          placeholder="DNMI Cinaruco, Dirección Territorial Orinoquia…"
          className="mt-1 w-full input-field !py-1.5 !text-xs" />
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">MUNICIPIO / DEPARTAMENTO</span>
        <input type="text" value={municipioDpto}
          onChange={(e) => setMunicipioDpto(e.target.value)}
          placeholder="Cravo Norte, Arauca"
          className="mt-1 w-full input-field !py-1.5 !text-xs" />
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">ESTADO ACTUAL</span>
        <select value={estadoActual} onChange={(e) => setEstadoActual(e.target.value)}
          title="Estado actual" aria-label="Estado actual"
          className="mt-1 w-full input-field !py-1.5 !text-xs">
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">ELABORADO POR</span>
        <input type="text" value={elaboradoPor}
          onChange={(e) => setElaboradoPor(e.target.value)}
          className="mt-1 w-full input-field !py-1.5 !text-xs" />
      </label>

      {/* Cobertura */}
      <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-2.5 space-y-2">
        <div className="text-xs font-mono text-orange-700 font-bold">COBERTURA AFECTADA</div>
        <div className="flex gap-2">
          <div className="w-28">
            <span className="text-[10px] text-txt-muted">HECTÁREAS</span>
            <input type="number" min={0} step={0.01} value={coberturaHa}
              onChange={(e) => setCoberturaHa(e.target.value)}
              placeholder="0.00"
              className="mt-0.5 w-full input-field !py-1 !text-xs" />
          </div>
          <div className="flex-1">
            <span className="text-[10px] text-txt-muted">TIPO DE COBERTURA</span>
            <input type="text" value={coberturaDesc}
              onChange={(e) => setCoberturaDesc(e.target.value)}
              placeholder="Sabana inundable, bosque de galería…"
              className="mt-0.5 w-full input-field !py-1 !text-xs" />
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-3">
        <ListaEntradas label="REPORTES DE CAMPO" items={reportesCampo} setItems={setReportesCampo} />
      </div>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NOTAS</span>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
          placeholder="Acciones de monitoreo, equipos preparados…"
          rows={2} className="mt-1 w-full input-field !py-1.5 !text-xs resize-y" />
      </label>

      <div className="border-t border-border-subtle pt-3">
        <ListaEntradas label="MONITOREO SATELITAL" items={monitoreo} setItems={setMonitoreo} conFocos />
      </div>

      <div className="border-t border-border-subtle pt-3">
        <ListaEntradas label="INTERVENCIONES DE CONTROL Y EXTINCIÓN" items={intervenciones} setItems={setIntervenciones} />
      </div>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">AFECTACIONES EN FAUNA (opcional)</span>
        <textarea value={fauna} onChange={(e) => setFauna(e.target.value)}
          placeholder="Especies afectadas, quemaduras, rescates…"
          rows={2} className="mt-1 w-full input-field !py-1.5 !text-xs resize-y" />
      </label>

      <button type="button" onClick={handleSubmit} disabled={isPending || !areaProtegida || !municipioDpto}
        className="w-full bg-orange-600 text-white font-bold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-50 transition text-sm">
        {isPending ? <Spinner /> : '🔥 GENERAR REPORTE INCENDIO'}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      Generando…
    </span>
  );
}

/* ──────────────────── Página principal ──────────────────── */
type FormMode = 'general' | 'incendio';

export function ReportesPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<FormMode>('general');
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

  const genGeneral = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.post('/reportes', body)).data,
    onSuccess: () => { showOk(); qc.invalidateQueries({ queryKey: ['reportes'] }); },
    onError: showErr,
  });

  const genIncendio = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.post('/reportes/incendio', body)).data,
    onSuccess: () => { showOk(); qc.invalidateQueries({ queryKey: ['reportes'] }); },
    onError: showErr,
  });

  function showOk() {
    setMsg({ text: 'Reporte generado correctamente', ok: true });
    setTimeout(() => setMsg(null), 4000);
  }
  function showErr(e: { response?: { data?: { message?: string } } }) {
    setMsg({ text: `Error: ${e.response?.data?.message ?? 'fallo en generación'}`, ok: false });
  }

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
      a.href = url; a.download = friendlyFilename(r);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setMsg({ text: 'Error al descargar el archivo', ok: false }); }
  }

  const eliminar = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/reportes/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reportes'] }),
  });

  const isPending = genGeneral.isPending || genIncendio.isPending;

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[360px_1fr] pb-20 md:pb-4">

        {/* Panel de generación */}
        <aside className="panel p-4 space-y-3 h-fit">
          <h2 className="text-sm font-bold tracking-wider">GENERAR REPORTE</h2>

          {/* Selector de modo */}
          <div className="flex gap-1 p-0.5 bg-bg-surface2 rounded-lg">
            <button type="button"
              onClick={() => setMode('general')}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${mode === 'general' ? 'bg-pnn-green text-bg-base' : 'text-txt-muted hover:text-txt'}`}>
              General
            </button>
            <button type="button"
              onClick={() => setMode('incendio')}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${mode === 'incendio' ? 'bg-orange-600 text-white' : 'text-txt-muted hover:text-txt'}`}>
              🔥 Incendio
            </button>
          </div>

          {mode === 'general' ? (
            <FormGeneral
              parques={parques.data}
              onSubmit={(body) => genGeneral.mutate(body)}
              isPending={isPending}
            />
          ) : (
            <FormIncendio
              parques={parques.data}
              onSubmit={(body) => genIncendio.mutate(body)}
              isPending={isPending}
            />
          )}

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
                  <th className="px-3 py-2" aria-label="Acciones"></th>
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
                      {r.tipo.includes('Incendio') && (
                        <span className="mr-1">🔥</span>
                      )}
                      <span className="font-medium text-txt truncate">{r.tipo}</span>
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
