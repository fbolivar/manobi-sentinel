import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import { useAuthStore } from '../stores/auth.store';
import type { Parque } from '../types';

type NivelRiesgo = 'bajo' | 'medio' | 'alto';

const RIESGO_CHIP: Record<NivelRiesgo, string> = {
  bajo: 'chip-verde',
  medio: 'chip-amarillo',
  alto: 'chip-rojo',
};

const EMPTY_FORM = { nombre: '', region: '', nivel_riesgo: '' as NivelRiesgo | '', area_ha: '', descripcion: '' };

export function ParquesPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const canEdit = me?.rol === 'admin' || me?.rol === 'operador';
  const canDelete = me?.rol === 'admin';

  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Parque | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const list = useQuery<Parque[]>({
    queryKey: ['parques'],
    queryFn: async () => (await api.get('/parques')).data,
    staleTime: 2 * 60_000,
  });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const crear = useMutation({
    mutationFn: async () => (await api.post('/parques', {
      nombre: form.nombre,
      ...(form.region && { region: form.region }),
      ...(form.nivel_riesgo && { nivel_riesgo: form.nivel_riesgo }),
      ...(form.area_ha && { area_ha: Number(form.area_ha) }),
      ...(form.descripcion && { descripcion: form.descripcion }),
    })).data,
    onSuccess: () => {
      setForm(EMPTY_FORM);
      flash('Parque creado');
      qc.invalidateQueries({ queryKey: ['parques'] });
      qc.invalidateQueries({ queryKey: ['parques-list'] });
    },
    onError: (e: Error & { response?: { data?: { message?: string | string[] } } }) => {
      const m = e.response?.data?.message;
      flash('Error: ' + (Array.isArray(m) ? m.join(', ') : m ?? e.message));
    },
  });

  const guardar = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      return (await api.patch(`/parques/${editing.id}`, {
        nombre: form.nombre,
        ...(form.region !== '' ? { region: form.region } : {}),
        ...(form.nivel_riesgo ? { nivel_riesgo: form.nivel_riesgo } : {}),
        ...(form.area_ha !== '' ? { area_ha: Number(form.area_ha) } : {}),
        ...(form.descripcion !== '' ? { descripcion: form.descripcion } : {}),
      })).data;
    },
    onSuccess: () => {
      setEditing(null);
      setForm(EMPTY_FORM);
      flash('Parque actualizado');
      qc.invalidateQueries({ queryKey: ['parques'] });
      qc.invalidateQueries({ queryKey: ['parques-list'] });
    },
    onError: (e: Error & { response?: { data?: { message?: string | string[] } } }) => {
      const m = e.response?.data?.message;
      flash('Error: ' + (Array.isArray(m) ? m.join(', ') : m ?? e.message));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/parques/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parques'] });
      qc.invalidateQueries({ queryKey: ['parques-list'] });
    },
  });

  const openEdit = (p: Parque) => {
    setEditing(p);
    setForm({
      nombre: p.nombre,
      region: p.region ?? '',
      nivel_riesgo: (p.nivel_riesgo as NivelRiesgo | null) ?? '',
      area_ha: p.area_ha != null ? String(p.area_ha) : '',
      descripcion: p.descripcion ?? '',
    });
    setMsg(null);
  };

  const cancelEdit = () => { setEditing(null); setForm(EMPTY_FORM); setMsg(null); };

  const filtered = list.data?.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.region ?? '').toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  const sidePanel = (
    <aside className="panel p-4 space-y-3 h-fit">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider">
          {editing ? 'EDITAR PARQUE' : 'NUEVO PARQUE'}
        </h2>
        {editing && (
          <button type="button" onClick={cancelEdit} className="text-txt-muted hover:text-white text-lg">×</button>
        )}
      </div>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NOMBRE *</span>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">REGIÓN</span>
        <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
          placeholder="Ej: Amazonía, Caribe, Andes…"
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NIVEL DE RIESGO</span>
        <select value={form.nivel_riesgo}
          onChange={(e) => setForm({ ...form, nivel_riesgo: e.target.value as NivelRiesgo | '' })}
          title="Nivel de riesgo" aria-label="Nivel de riesgo"
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm">
          <option value="">— Sin definir —</option>
          <option value="bajo">Bajo</option>
          <option value="medio">Medio</option>
          <option value="alto">Alto</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">ÁREA (ha)</span>
        <input type="number" min="0" value={form.area_ha}
          onChange={(e) => setForm({ ...form, area_ha: e.target.value })}
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">DESCRIPCIÓN</span>
        <textarea value={form.descripcion} rows={3}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm resize-none" />
      </label>

      {canEdit && (
        <button type="button"
          onClick={() => editing ? guardar.mutate() : crear.mutate()}
          disabled={(crear.isPending || guardar.isPending) || !form.nombre.trim()}
          className="w-full bg-pnn-green text-bg font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50">
          {(crear.isPending || guardar.isPending) ? 'Guardando…' : editing ? 'GUARDAR CAMBIOS' : 'CREAR'}
        </button>
      )}
      {editing && (
        <button type="button" onClick={cancelEdit}
          className="w-full border border-border-subtle text-txt-muted py-2 rounded hover:bg-bg-surface2 text-xs">
          Cancelar
        </button>
      )}
      {msg && (
        <div className={`text-xs ${msg.startsWith('Error') ? 'text-accent-red' : 'text-pnn-blue'}`}>{msg}</div>
      )}
      <Link to="/dashboard" className="block text-xs text-txt-muted hover:text-pnn-blue">← Volver al dashboard</Link>
    </aside>
  );

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4 grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[360px_1fr]">
        {sidePanel}

        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-3">
            <h2 className="text-sm font-bold tracking-wider shrink-0">PARQUES ({filtered.length})</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o región…"
              className="flex-1 bg-bg-surface2 border border-border-subtle rounded px-2 py-1 text-xs font-mono" />
          </div>
          <div className="overflow-y-auto flex-1">
            {/* Desktop */}
            <table className="w-full text-xs hidden md:table">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">NOMBRE</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">REGIÓN</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">RIESGO</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">ÁREA (ha)</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">CREADO</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.isLoading && (
                  <tr><td colSpan={6} className="text-center py-6 text-txt-light">Cargando…</td></tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2 font-medium">{p.nombre}</td>
                    <td className="px-3 py-2 text-txt-muted">{p.region ?? '—'}</td>
                    <td className="px-3 py-2">
                      {p.nivel_riesgo
                        ? <span className={`chip ${RIESGO_CHIP[p.nivel_riesgo]}`}>{p.nivel_riesgo}</span>
                        : <span className="text-txt-light">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {p.area_ha != null ? p.area_ha.toLocaleString('es-CO') : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-txt-muted">
                      {new Date(p.creado_en).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        {canEdit && (
                          <button type="button" onClick={() => openEdit(p)}
                            className="text-xs px-3 py-1.5 border border-pnn-blue/50 text-pnn-blue rounded hover:bg-pnn-blue/10">
                            Editar
                          </button>
                        )}
                        {canDelete && (
                          <button type="button"
                            onClick={() => confirm(`¿Eliminar "${p.nombre}"?`) && remove.mutate(p.id)}
                            className="text-xs px-3 py-1.5 border border-accent-red/50 text-accent-red rounded hover:bg-accent-red/10">
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border-subtle">
              {list.isLoading && <div className="p-4 text-xs text-txt-light">Cargando…</div>}
              {filtered.map((p) => (
                <div key={p.id} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{p.nombre}</div>
                    {p.nivel_riesgo && (
                      <span className={`chip ${RIESGO_CHIP[p.nivel_riesgo]}`}>{p.nivel_riesgo}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-txt-muted font-mono">
                    {p.region ?? 'Sin región'}{p.area_ha != null ? ` · ${p.area_ha.toLocaleString('es-CO')} ha` : ''}
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex gap-2 pt-1">
                      {canEdit && (
                        <button type="button" onClick={() => openEdit(p)}
                          className="flex-1 text-xs py-2 border border-pnn-blue/50 text-pnn-blue rounded hover:bg-pnn-blue/10">
                          Editar
                        </button>
                      )}
                      {canDelete && (
                        <button type="button"
                          onClick={() => confirm(`¿Eliminar "${p.nombre}"?`) && remove.mutate(p.id)}
                          className="text-xs py-2 px-4 border border-accent-red/50 text-accent-red rounded hover:bg-accent-red/10">
                          Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
