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

export function UsuariosPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const esAdmin = me?.rol === 'admin';

  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'operador' as Rol });
  const [msg, setMsg] = useState<string | null>(null);

  const list = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios')).data,
    enabled: esAdmin,
  });

  const crear = useMutation({
    mutationFn: async () => (await api.post('/usuarios', form)).data,
    onSuccess: () => {
      setMsg('Usuario creado');
      setForm({ nombre: '', email: '', password: '', rol: 'operador' });
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e: Error & { response?: { data?: { message?: string | string[] } } }) => {
      const m = e.response?.data?.message;
      setMsg('Error: ' + (Array.isArray(m) ? m.join(', ') : m ?? e.message));
    },
  });

  const toggle = useMutation({
    mutationFn: async (u: Usuario) => (await api.patch(`/usuarios/${u.id}`, { activo: !u.activo })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  const setRol = useMutation({
    mutationFn: async ({ u, rol }: { u: Usuario; rol: Rol }) =>
      (await api.patch(`/usuarios/${u.id}`, { rol })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/usuarios/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  if (!esAdmin) {
    return (
      <div className="h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 grid place-items-center">
          <div className="panel p-6 text-center">
            <div className="text-accent-red text-sm font-bold">Acceso restringido</div>
            <div className="text-xs text-white/50 mt-1">Solo administradores pueden gestionar usuarios.</div>
            <Link to="/dashboard" className="inline-block mt-3 text-xs text-accent-blue hover:underline">← Volver</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-4 grid gap-4 grid-cols-1 md:grid-cols-[360px_1fr]">
        <aside className="panel p-4 space-y-3 h-fit">
          <h2 className="text-sm font-bold tracking-wider">NUEVO USUARIO</h2>
          <label className="block">
            <span className="text-xs font-mono text-white/50">NOMBRE</span>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-white/50">EMAIL</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-white/50">CONTRASEÑA (≥8)</span>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-white/50">ROL</span>
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
              title="Rol" aria-label="Rol"
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-sm">
              <option value="admin">Admin</option>
              <option value="operador">Operador</option>
              <option value="consulta">Consulta</option>
            </select>
          </label>
          <button onClick={() => crear.mutate()} disabled={crear.isPending || !form.email || form.password.length < 8}
            className="w-full bg-accent-green text-bg font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50">
            {crear.isPending ? 'Creando…' : 'CREAR'}
          </button>
          {msg && <div className={`text-xs ${msg.startsWith('Error') ? 'text-accent-red' : 'text-accent-blue'}`}>{msg}</div>}
          <Link to="/dashboard" className="block text-xs text-white/50 hover:text-accent-blue">← Volver al dashboard</Link>
        </aside>

        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-sm font-bold tracking-wider">USUARIOS ({list.data?.length ?? 0})</h2>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-white/50">NOMBRE</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">EMAIL</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">ROL</th>
                  <th className="px-3 py-2 text-left font-mono text-white/50">ÚLTIMO LOGIN</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={5} className="text-center py-6 text-white/40">Cargando…</td></tr>}
                {list.data?.map((u) => (
                  <tr key={u.id} className="border-b border-border-subtle/50 hover:bg-bg-surface2/50">
                    <td className="px-3 py-2">{u.nombre}</td>
                    <td className="px-3 py-2 font-mono text-white/70">{u.email}</td>
                    <td className="px-3 py-2">
                      <select value={u.rol} onChange={(e) => setRol.mutate({ u, rol: e.target.value as Rol })}
                        disabled={u.id === me?.id}
                        title="Rol" aria-label="Rol"
                        className="bg-bg-surface2 border border-border-subtle rounded px-2 py-1 font-mono text-xs">
                        <option value="admin">admin</option>
                        <option value="operador">operador</option>
                        <option value="consulta">consulta</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 font-mono text-white/60">
                      {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right flex gap-1 justify-end">
                      <button onClick={() => toggle.mutate(u)}
                        disabled={u.id === me?.id}
                        className="text-xs px-2 py-1 border border-border-subtle rounded hover:bg-bg-surface2 disabled:opacity-30">
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => confirm(`¿Eliminar ${u.email}?`) && remove.mutate(u.id)}
                        disabled={u.id === me?.id}
                        className="text-xs px-2 py-1 border border-accent-red/50 text-accent-red rounded hover:bg-accent-red/10 disabled:opacity-30">
                        Eliminar
                      </button>
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
