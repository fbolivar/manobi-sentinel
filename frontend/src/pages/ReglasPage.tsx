import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import { useAuthStore } from '../stores/auth.store';

interface Regla {
  id: string;
  nombre: string | null;
  condicion: Record<string, unknown>;
  accion: string | null;
  nivel_resultante: 'verde' | 'amarillo' | 'rojo' | null;
  activa: boolean;
  creado_en: string;
}

const BLANK: Omit<Regla, 'id' | 'creado_en'> = {
  nombre: '',
  condicion: { operador: 'AND', condiciones: [{ campo: '', comparador: '>', valor: 0 }] },
  accion: '',
  nivel_resultante: 'amarillo',
  activa: true,
};

export function ReglasPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const esAdmin = user?.rol === 'admin';
  const [editing, setEditing] = useState<Regla | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  const list = useQuery<Regla[]>({
    queryKey: ['reglas'],
    queryFn: async () => (await api.get('/reglas')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      let condicion: unknown;
      try { condicion = JSON.parse(draft); }
      catch (e) { throw new Error(`JSON inválido: ${(e as Error).message}`); }
      const body = { ...editing, condicion };
      if ('id' in editing && editing.id) return (await api.patch(`/reglas/${editing.id}`, body)).data;
      return (await api.post('/reglas', body)).data;
    },
    onSuccess: () => {
      setEditing(null); setErr(null);
      qc.invalidateQueries({ queryKey: ['reglas'] });
    },
    onError: (e: Error & { response?: { data?: { message?: string | string[] } } }) => {
      const m = e.response?.data?.message;
      setErr(Array.isArray(m) ? m.join(', ') : m ?? e.message);
    },
  });

  const toggle = useMutation({
    mutationFn: async (r: Regla) => (await api.patch(`/reglas/${r.id}`, { activa: !r.activa })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reglas'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/reglas/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reglas'] }),
  });

  const openEdit = (r: Regla | null) => {
    const base = r ?? { ...BLANK, id: '' as unknown as Regla['id'], creado_en: '' };
    setEditing(base as Regla);
    setDraft(JSON.stringify(r?.condicion ?? BLANK.condicion, null, 2));
    setErr(null);
  };

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4 grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-[1fr_420px]">
        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider">REGLAS DE ALERTA ({list.data?.length ?? 0})</h2>
            {esAdmin && (
              <button onClick={() => openEdit(null)}
                className="text-xs px-3 py-1 bg-accent-green text-bg font-bold rounded hover:brightness-110">
                + NUEVA
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-border-subtle">
            {list.isLoading && <div className="p-6 text-center text-white/40 text-xs">Cargando…</div>}
            {list.data?.length === 0 && <div className="p-6 text-center text-white/40 text-xs">Sin reglas.</div>}
            {list.data?.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${r.activa ? 'bg-accent-green animate-pulse' : 'bg-white/20'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{r.nombre ?? '(sin nombre)'}</div>
                  <div className="text-[10px] font-mono text-white/50 truncate">{JSON.stringify(r.condicion)}</div>
                </div>
                {r.nivel_resultante && (
                  <span className={`chip chip-${r.nivel_resultante === 'rojo' ? 'rojo' : r.nivel_resultante === 'amarillo' ? 'amarillo' : 'verde'}`}>
                    {r.nivel_resultante.toUpperCase()}
                  </span>
                )}
                <button onClick={() => openEdit(r)}
                  className="text-xs px-2 py-1 border border-border-subtle rounded hover:bg-bg-surface2">
                  Editar
                </button>
                {esAdmin && (
                  <>
                    <button onClick={() => toggle.mutate(r)}
                      className="text-xs px-2 py-1 border border-border-subtle rounded hover:bg-bg-surface2">
                      {r.activa ? 'Pausar' : 'Reactivar'}
                    </button>
                    <button onClick={() => confirm('¿Eliminar regla?') && remove.mutate(r.id)}
                      className="text-xs px-2 py-1 border border-accent-red/50 text-accent-red rounded hover:bg-accent-red/10">
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border-subtle">
            <Link to="/dashboard" className="text-xs text-white/50 hover:text-accent-blue">← Volver al dashboard</Link>
          </div>
        </section>

        {editing && (
          <aside className="panel p-4 space-y-3 h-fit sticky top-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wider">{editing.id ? 'EDITAR REGLA' : 'NUEVA REGLA'}</h2>
              <button onClick={() => setEditing(null)} className="text-white/50 hover:text-white">✕</button>
            </div>
            {!esAdmin && <div className="text-xs text-accent-red">Solo admin puede guardar.</div>}
            <label className="block">
              <span className="text-xs font-mono text-white/50">NOMBRE</span>
              <input value={editing.nombre ?? ''} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-mono text-white/50">NIVEL RESULTANTE</span>
              <select value={editing.nivel_resultante ?? 'amarillo'}
                onChange={(e) => setEditing({ ...editing, nivel_resultante: e.target.value as Regla['nivel_resultante'] })}
                title="Nivel" aria-label="Nivel"
                className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm">
                <option value="verde">Verde</option>
                <option value="amarillo">Amarillo</option>
                <option value="rojo">Rojo</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-mono text-white/50">ACCIÓN (descripción)</span>
              <input value={editing.accion ?? ''} onChange={(e) => setEditing({ ...editing, accion: e.target.value })}
                className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-mono text-white/50">CONDICIÓN (JSON)</span>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                rows={12}
                className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-xs whitespace-pre" />
            </label>
            <div className="text-[10px] font-mono text-white/40">
              Campos disponibles: temperatura_c, humedad_relativa, dias_sin_lluvia, viento_kmh,
              lluvia_24h_mm, lluvia_1h_mm, parque.nivel_riesgo, prediccion_ia.probabilidad, prediccion_ia.incendio, prediccion_ia.inundacion
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.activa}
                onChange={(e) => setEditing({ ...editing, activa: e.target.checked })} />
              <span>Activa</span>
            </label>
            {err && <div className="text-xs text-accent-red border border-accent-red/40 rounded p-2">{err}</div>}
            <button onClick={() => save.mutate()} disabled={!esAdmin || save.isPending}
              className="w-full bg-accent-green text-bg font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50">
              {save.isPending ? 'Guardando…' : 'GUARDAR'}
            </button>
          </aside>
        )}
      </main>
    </div>
  );
}
