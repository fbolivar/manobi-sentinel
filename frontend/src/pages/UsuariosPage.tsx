import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import { useAuthStore } from '../stores/auth.store';

type Rol = 'admin' | 'operador' | 'consulta';

interface Usuario {
  id: string; nombre: string; email: string; rol: Rol; activo: boolean;
  ultimo_login: string | null; creado_en: string;
}

interface EditForm {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  password: string;
}

export function UsuariosPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const esAdmin = me?.rol === 'admin';

  const [createForm, setCreateForm] = useState({ nombre: '', email: '', password: '', rol: 'operador' as Rol });
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const list = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios')).data,
    enabled: esAdmin,
  });

  const crear = useMutation({
    mutationFn: async () => (await api.post('/usuarios', createForm)).data,
    onSuccess: () => {
      setMsg('Usuario creado');
      setCreateForm({ nombre: '', email: '', password: '', rol: 'operador' });
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e: Error & { response?: { data?: { message?: string | string[] } } }) => {
      const m = e.response?.data?.message;
      setMsg('Error: ' + (Array.isArray(m) ? m.join(', ') : m ?? e.message));
    },
  });

  const guardar = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const body: Record<string, unknown> = {
        nombre: editing.nombre,
        rol: editing.rol,
        activo: editing.activo,
      };
      if (editing.password.length >= 8) body.password = editing.password;
      return (await api.patch(`/usuarios/${editing.id}`, body)).data;
    },
    onSuccess: () => {
      setEditing(null);
      setMsg('Usuario actualizado');
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e: Error & { response?: { data?: { message?: string | string[] } } }) => {
      const m = e.response?.data?.message;
      setMsg('Error: ' + (Array.isArray(m) ? m.join(', ') : m ?? e.message));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/usuarios/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  const openEdit = (u: Usuario) => {
    setEditing({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo, password: '' });
    setMsg(null);
  };

  if (!esAdmin) {
    return (
      <div className="h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 grid place-items-center pb-20 md:pb-0">
          <div className="panel p-6 text-center">
            <div className="text-accent-red text-sm font-bold">Acceso restringido</div>
            <div className="text-xs text-txt-muted mt-1">Solo administradores pueden gestionar usuarios.</div>
            <Link to="/dashboard" className="inline-block mt-3 text-xs text-pnn-blue hover:underline">← Volver</Link>
          </div>
        </main>
      </div>
    );
  }

  const sidePanel = editing ? (
    <aside className="panel p-4 space-y-3 h-fit">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider">EDITAR USUARIO</h2>
        <button type="button" onClick={() => setEditing(null)} className="text-txt-muted hover:text-txt text-lg">×</button>
      </div>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NOMBRE</span>
        <input value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">EMAIL</span>
        <input value={editing.email} disabled
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm opacity-50" />
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">ROL</span>
        <select value={editing.rol} onChange={(e) => setEditing({ ...editing, rol: e.target.value as Rol })}
          disabled={editing.id === me?.id} title="Rol" aria-label="Rol"
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm disabled:opacity-50">
          <option value="admin">Admin</option>
          <option value="operador">Operador</option>
          <option value="consulta">Consulta</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NUEVA CONTRASEÑA (dejar vacío para no cambiar)</span>
        <input type="password" value={editing.password}
          onChange={(e) => setEditing({ ...editing, password: e.target.value })}
          placeholder="mín. 8 caracteres"
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
      </label>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={editing.activo}
          disabled={editing.id === me?.id}
          onChange={(e) => setEditing({ ...editing, activo: e.target.checked })}
          className="h-4 w-4" />
        <span>Cuenta activa</span>
      </label>
      {editing.password.length > 0 && editing.password.length < 8 && (
        <div className="text-xs text-accent-red">La contraseña debe tener al menos 8 caracteres</div>
      )}
      <button type="button" onClick={() => guardar.mutate()}
        disabled={guardar.isPending || (editing.password.length > 0 && editing.password.length < 8)}
        className="w-full bg-accent-green text-bg font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50">
        {guardar.isPending ? 'Guardando…' : 'GUARDAR CAMBIOS'}
      </button>
      <button type="button" onClick={() => setEditing(null)}
        className="w-full border border-border-subtle text-txt-muted py-2 rounded hover:bg-bg-surface2 text-xs">
        Cancelar
      </button>
    </aside>
  ) : (
    <aside className="panel p-4 space-y-3 h-fit">
      <h2 className="text-sm font-bold tracking-wider">NUEVO USUARIO</h2>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NOMBRE</span>
        <input value={createForm.nombre} onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">EMAIL</span>
        <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">CONTRASEÑA (≥8)</span>
        <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block">
        <span className="text-xs font-mono text-txt-muted">ROL</span>
        <select value={createForm.rol} onChange={(e) => setCreateForm({ ...createForm, rol: e.target.value as Rol })}
          title="Rol" aria-label="Rol"
          className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm">
          <option value="admin">Admin</option>
          <option value="operador">Operador</option>
          <option value="consulta">Consulta</option>
        </select>
      </label>
      <button type="button" onClick={() => crear.mutate()} disabled={crear.isPending || !createForm.email || createForm.password.length < 8}
        className="w-full bg-accent-green text-bg font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50">
        {crear.isPending ? 'Creando…' : 'CREAR'}
      </button>
      {msg && <div className={`text-xs ${msg.startsWith('Error') ? 'text-accent-red' : 'text-pnn-blue'}`}>{msg}</div>}
      <Link to="/dashboard" className="block text-xs text-txt-muted hover:text-pnn-blue">← Volver al dashboard</Link>
    </aside>
  );

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4 grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[360px_1fr]">
        {sidePanel}

        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-sm font-bold tracking-wider">USUARIOS ({list.data?.length ?? 0})</h2>
          </div>
          <div className="overflow-y-auto flex-1">
            {/* Desktop: table */}
            <table className="w-full text-xs hidden md:table">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">NOMBRE</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">EMAIL</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">ROL</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">ESTADO</th>
                  <th className="px-3 py-2 text-left font-mono text-txt-muted">ÚLTIMO LOGIN</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={6} className="text-center py-6 text-txt-light">Cargando…</td></tr>}
                {list.data?.map((u) => (
                  <tr key={u.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2">{u.nombre}</td>
                    <td className="px-3 py-2 font-mono text-txt-muted">{u.email}</td>
                    <td className="px-3 py-2">
                      <span className={`chip ${u.rol === 'admin' ? 'chip-rojo' : u.rol === 'operador' ? 'chip-amarillo' : 'chip-verde'}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${u.activo ? 'bg-accent-green' : 'bg-white/20'}`} />
                      <span className="ml-1.5">{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-txt-muted">
                      {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right flex gap-1 justify-end">
                      <button type="button" onClick={() => openEdit(u)}
                        className="text-xs px-3 py-1.5 border border-pnn-blue/50 text-pnn-blue rounded hover:bg-pnn-blue/10">
                        Editar
                      </button>
                      <button type="button" onClick={() => confirm(`¿Eliminar ${u.email}?`) && remove.mutate(u.id)}
                        disabled={u.id === me?.id}
                        className="text-xs px-3 py-1.5 border border-accent-red/50 text-accent-red rounded hover:bg-accent-red/10 disabled:opacity-30">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-border-subtle">
              {list.isLoading && <div className="p-4 text-xs text-txt-light">Cargando…</div>}
              {list.data?.map((u) => (
                <div key={u.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">{u.nombre}</div>
                      <div className="text-[11px] font-mono text-txt-muted">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${u.activo ? 'bg-accent-green' : 'bg-white/20'}`} />
                      <span className={`chip ${u.rol === 'admin' ? 'chip-rojo' : u.rol === 'operador' ? 'chip-amarillo' : 'chip-verde'}`}>
                        {u.rol}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(u)}
                      className="flex-1 text-xs py-2 border border-pnn-blue/50 text-pnn-blue rounded hover:bg-pnn-blue/10 touch-target">
                      Editar
                    </button>
                    <button type="button" onClick={() => confirm(`¿Eliminar ${u.email}?`) && remove.mutate(u.id)}
                      disabled={u.id === me?.id}
                      className="text-xs py-2 px-4 border border-accent-red/50 text-accent-red rounded hover:bg-accent-red/10 disabled:opacity-30 touch-target">
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
