import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import { useAuthStore } from '../stores/auth.store';

interface TwoFaStatus { enabled: boolean; source: 'db' | 'env'; }

type Rol = 'admin' | 'operador' | 'consulta';

interface Usuario {
  id: string; nombre: string; email: string; rol: Rol; activo: boolean;
  ultimo_login: string | null; creado_en: string;
}

interface EditForm {
  id: string; nombre: string; email: string; rol: Rol; activo: boolean; password: string;
}

const ROL_CHIP: Record<Rol, string> = {
  admin: 'chip chip-rojo',
  operador: 'chip chip-amarillo',
  consulta: 'chip chip-verde',
};

const ROL_DESC: Record<Rol, string> = {
  admin: 'Acceso total al sistema',
  operador: 'Gestiona alertas y parques',
  consulta: 'Solo lectura',
};

const inputCls = 'mt-1 w-full input-field !py-2 !text-sm';

export function UsuariosPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const esAdmin = me?.rol === 'admin';

  const [createForm, setCreateForm] = useState({ nombre: '', email: '', password: '', rol: 'operador' as Rol });
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showEditPass, setShowEditPass] = useState(false);
  const [confirm2fa, setConfirm2fa] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const list = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios')).data,
    enabled: esAdmin,
  });

  const twoFa = useQuery<TwoFaStatus>({
    queryKey: ['2fa-status'],
    queryFn: async () => (await api.get('/auth/2fa-status')).data,
    enabled: esAdmin,
  });

  const toggle2fa = useMutation({
    mutationFn: async (enabled: boolean) => (await api.put('/auth/2fa-status', { enabled })).data,
    onSuccess: (_data, enabled) => {
      setConfirm2fa(false);
      setTwoFaMsg({ text: enabled ? '2FA activado — los usuarios necesitarán código OTP al iniciar sesión.' : '2FA desactivado — acceso solo con contraseña.', ok: enabled });
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
      setTimeout(() => setTwoFaMsg(null), 5000);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setConfirm2fa(false);
      setTwoFaMsg({ text: `Error: ${e.response?.data?.message ?? 'No se pudo cambiar el estado'}`, ok: false });
      setTimeout(() => setTwoFaMsg(null), 5000);
    },
  });

  function notify(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  const crear = useMutation({
    mutationFn: async () => (await api.post('/usuarios', createForm)).data,
    onSuccess: () => {
      notify('Usuario creado correctamente');
      setCreateForm({ nombre: '', email: '', password: '', rol: 'operador' });
      qc.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (e: Error & { response?: { data?: { message?: string | string[] } } }) => {
      const m = e.response?.data?.message;
      notify('Error: ' + (Array.isArray(m) ? m.join(', ') : m ?? e.message), false);
    },
  });

  const guardar = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const body: Record<string, unknown> = { nombre: editing.nombre, rol: editing.rol, activo: editing.activo };
      if (editing.password.length >= 8) body.password = editing.password;
      return (await api.patch(`/usuarios/${editing.id}`, body)).data;
    },
    onSuccess: () => {
      setEditing(null);
      notify('Usuario actualizado correctamente');
      qc.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (e: Error & { response?: { data?: { message?: string | string[] } } }) => {
      const m = e.response?.data?.message;
      notify('Error: ' + (Array.isArray(m) ? m.join(', ') : m ?? e.message), false);
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
    /* ── Panel edición ── */
    <aside className="panel p-4 space-y-3 h-fit">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider">EDITAR USUARIO</h2>
        <button type="button" onClick={() => setEditing(null)}
          className="text-txt-muted hover:text-txt text-xl leading-none">×</button>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-surface2 border border-border-subtle">
        <div className="h-9 w-9 rounded-full bg-pnn-green/10 grid place-items-center text-pnn-green-dark font-bold text-sm shrink-0">
          {editing.nombre.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-txt truncate">{editing.nombre || '—'}</div>
          <div className="text-[11px] font-mono text-txt-muted truncate">{editing.email}</div>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NOMBRE COMPLETO</span>
        <input value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
          placeholder="Ej: Ana Torres" className={inputCls} />
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">CORREO ELECTRÓNICO</span>
        <input value={editing.email} disabled
          className={`${inputCls} opacity-50 cursor-not-allowed`} />
        <span className="text-[10px] text-txt-muted mt-0.5 block">El email no se puede cambiar</span>
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">ROL</span>
        <select value={editing.rol} onChange={(e) => setEditing({ ...editing, rol: e.target.value as Rol })}
          disabled={editing.id === me?.id} title="Rol" aria-label="Rol"
          className={`${inputCls} disabled:opacity-50`}>
          <option value="admin">Admin — {ROL_DESC.admin}</option>
          <option value="operador">Operador — {ROL_DESC.operador}</option>
          <option value="consulta">Consulta — {ROL_DESC.consulta}</option>
        </select>
        {editing.id === me?.id && (
          <span className="text-[10px] text-txt-muted mt-0.5 block">No puedes cambiar tu propio rol</span>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NUEVA CONTRASEÑA</span>
        <div className="relative">
          <input type={showEditPass ? 'text' : 'password'} value={editing.password}
            onChange={(e) => setEditing({ ...editing, password: e.target.value })}
            placeholder="Dejar vacío para no cambiar (mín. 8 caracteres)"
            className={`${inputCls} pr-20`} />
          <button type="button" onClick={() => setShowEditPass((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-txt-muted hover:text-txt font-mono">
            {showEditPass ? 'OCULTAR' : 'MOSTRAR'}
          </button>
        </div>
        {editing.password.length > 0 && editing.password.length < 8 && (
          <span className="text-[10px] text-accent-red mt-0.5 block">Mínimo 8 caracteres</span>
        )}
      </label>

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input type="checkbox" checked={editing.activo} disabled={editing.id === me?.id}
          onChange={(e) => setEditing({ ...editing, activo: e.target.checked })}
          className="h-4 w-4 accent-pnn-green" />
        <span className="text-sm text-txt">Cuenta activa</span>
        {editing.id === me?.id && <span className="text-[10px] text-txt-muted">(tu propia cuenta)</span>}
      </label>

      <button type="button" onClick={() => guardar.mutate()}
        disabled={guardar.isPending || (editing.password.length > 0 && editing.password.length < 8)}
        className="w-full bg-pnn-green text-bg-base font-bold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-50 transition text-sm">
        {guardar.isPending ? 'Guardando…' : 'GUARDAR CAMBIOS'}
      </button>
      <button type="button" onClick={() => setEditing(null)}
        className="w-full border border-border-subtle text-txt-muted py-2 rounded-lg hover:bg-bg-surface2 text-xs transition">
        Cancelar
      </button>

      {msg && (
        <div className={`text-xs px-3 py-2 rounded border ${
          msg.ok ? 'border-pnn-green/30 bg-pnn-green/10 text-pnn-green-dark' : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
        }`}>{msg.text}</div>
      )}
    </aside>
  ) : (
    /* ── Panel crear ── */
    <aside className="panel p-4 space-y-3 h-fit">
      <h2 className="text-sm font-bold tracking-wider">NUEVO USUARIO</h2>
      <p className="text-xs text-txt-muted">Completa todos los campos para dar acceso al sistema.</p>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">NOMBRE COMPLETO <span className="text-accent-red">*</span></span>
        <input value={createForm.nombre}
          onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
          placeholder="Ej: Ana Torres Ruiz"
          className={inputCls} />
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">CORREO ELECTRÓNICO <span className="text-accent-red">*</span></span>
        <input type="email" value={createForm.email}
          onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
          placeholder="usuario@parques.gov.co"
          className={inputCls} />
        <span className="text-[10px] text-txt-muted mt-0.5 block">Se usará para iniciar sesión y recibir notificaciones</span>
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">CONTRASEÑA INICIAL <span className="text-accent-red">*</span></span>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            placeholder="Mínimo 8 caracteres"
            className={`${inputCls} pr-20`} />
          <button type="button" onClick={() => setShowPass((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-txt-muted hover:text-txt font-mono">
            {showPass ? 'OCULTAR' : 'MOSTRAR'}
          </button>
        </div>
        {createForm.password.length > 0 && createForm.password.length < 8 && (
          <span className="text-[10px] text-accent-red mt-0.5 block">Mínimo 8 caracteres</span>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-mono text-txt-muted">ROL <span className="text-accent-red">*</span></span>
        <select value={createForm.rol}
          onChange={(e) => setCreateForm({ ...createForm, rol: e.target.value as Rol })}
          title="Rol del usuario" aria-label="Rol del usuario"
          className={inputCls}>
          <option value="admin">Admin — Acceso total al sistema</option>
          <option value="operador">Operador — Gestiona alertas y parques</option>
          <option value="consulta">Consulta — Solo lectura</option>
        </select>
        <span className="text-[10px] text-txt-muted mt-0.5 block">{ROL_DESC[createForm.rol]}</span>
      </label>

      <button type="button" onClick={() => crear.mutate()}
        disabled={crear.isPending || !createForm.nombre || !createForm.email || createForm.password.length < 8}
        className="w-full bg-pnn-green text-bg-base font-bold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-50 transition text-sm">
        {crear.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-3.5 w-3.5 border-2 border-bg-base/30 border-t-bg-base rounded-full animate-spin" />
            Creando…
          </span>
        ) : 'CREAR USUARIO'}
      </button>

      {msg && (
        <div className={`text-xs px-3 py-2 rounded border ${
          msg.ok ? 'border-pnn-green/30 bg-pnn-green/10 text-pnn-green-dark' : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
        }`}>{msg.text}</div>
      )}

      <Link to="/dashboard" className="block text-xs text-txt-muted hover:text-pnn-blue">← Volver al dashboard</Link>
    </aside>
  );

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4 grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[380px_1fr]">
        {sidePanel}

        <div className="space-y-3 md:space-y-4 flex flex-col overflow-hidden">
          {/* Panel estado 2FA */}
          <div className={`panel px-4 py-3 space-y-2 border-l-4 ${
            twoFa.data?.enabled ? 'border-l-pnn-green' : 'border-l-accent-red'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl">{twoFa.data?.enabled ? '🔒' : '🔓'}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-txt">Autenticación de dos factores</span>
                    {twoFa.data && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        twoFa.data.enabled
                          ? 'bg-pnn-green/10 border-pnn-green/30 text-pnn-green-dark'
                          : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                      }`}>
                        {twoFa.data.enabled ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-txt-muted mt-0.5">
                    {twoFa.data?.enabled
                      ? 'Todos los usuarios deben verificar un código OTP por correo al iniciar sesión.'
                      : 'El segundo factor está desactivado — los usuarios acceden solo con contraseña.'}
                  </p>
                </div>
              </div>
              {esAdmin && twoFa.data && !confirm2fa && (
                <button
                  type="button"
                  disabled={toggle2fa.isPending}
                  onClick={() => setConfirm2fa(true)}
                  className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                    twoFa.data.enabled ? 'bg-pnn-green' : 'bg-border-subtle'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    twoFa.data.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                  <span className="sr-only">{twoFa.data.enabled ? 'Desactivar 2FA' : 'Activar 2FA'}</span>
                </button>
              )}
            </div>

            {/* Confirmación inline */}
            {confirm2fa && twoFa.data && (
              <div className="flex items-center gap-3 pt-1 border-t border-border-subtle">
                <span className="text-xs text-txt flex-1">
                  {twoFa.data.enabled
                    ? '¿Desactivar el 2FA? Los usuarios accederán solo con contraseña.'
                    : '¿Activar el 2FA? Todos los usuarios necesitarán un código OTP por correo.'}
                </span>
                <button type="button" onClick={() => setConfirm2fa(false)}
                  className="text-xs px-3 py-1.5 border border-border-subtle rounded-lg text-txt-muted hover:bg-bg-surface2 transition">
                  Cancelar
                </button>
                <button type="button"
                  disabled={toggle2fa.isPending}
                  onClick={() => toggle2fa.mutate(!twoFa.data!.enabled)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50 ${
                    twoFa.data.enabled
                      ? 'bg-accent-red/10 border border-accent-red/40 text-accent-red hover:bg-accent-red/20'
                      : 'bg-pnn-green/10 border border-pnn-green/40 text-pnn-green-dark hover:bg-pnn-green/20'
                  }`}>
                  {toggle2fa.isPending ? 'Aplicando…' : twoFa.data.enabled ? 'Sí, desactivar' : 'Sí, activar'}
                </button>
              </div>
            )}

            {/* Feedback */}
            {twoFaMsg && (
              <div className={`text-xs px-3 py-2 rounded border ${
                twoFaMsg.ok
                  ? 'border-pnn-green/30 bg-pnn-green/10 text-pnn-green-dark'
                  : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
              }`}>
                {twoFaMsg.text}
              </div>
            )}
          </div>

          {/* Tabla de usuarios */}
          <section className="panel overflow-hidden flex flex-col flex-1">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider">USUARIOS ({list.data?.length ?? 0})</h2>
            {list.isFetching && <span className="text-[10px] font-mono text-txt-muted animate-pulse">actualizando…</span>}
          </div>
          <div className="overflow-y-auto flex-1">

            {/* Desktop */}
            <table className="w-full text-xs hidden md:table">
              <thead className="bg-bg-surface/50 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left font-mono text-txt-muted">NOMBRE</th>
                  <th className="px-4 py-2.5 text-left font-mono text-txt-muted">CORREO</th>
                  <th className="px-4 py-2.5 text-left font-mono text-txt-muted">ROL</th>
                  <th className="px-4 py-2.5 text-left font-mono text-txt-muted">ESTADO</th>
                  <th className="px-4 py-2.5 text-left font-mono text-txt-muted">ÚLTIMO ACCESO</th>
                  <th className="px-4 py-2.5 text-left font-mono text-txt-muted">2FA</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && (
                  <tr><td colSpan={6} className="text-center py-8 text-txt-light">Cargando usuarios…</td></tr>
                )}
                {list.data?.map((u) => (
                  <tr key={u.id} className={`border-b border-border-subtle/50 hover:bg-bg-surface2/50 ${editing?.id === u.id ? 'bg-pnn-blue/5' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-pnn-green/10 grid place-items-center text-pnn-green-dark font-bold text-xs shrink-0">
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-txt">{u.nombre}</span>
                        {u.id === me?.id && <span className="text-[9px] font-mono text-txt-muted">(tú)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-txt-muted">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={ROL_CHIP[u.rol]}>{u.rol}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${u.activo ? 'text-pnn-green-dark' : 'text-txt-muted'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.activo ? 'bg-pnn-green' : 'bg-txt-muted'}`} />
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-txt-muted text-[11px]">
                      {u.ultimo_login
                        ? new Date(u.ultimo_login).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : <span className="text-txt-light">Nunca</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {twoFa.data ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          twoFa.data.enabled
                            ? 'bg-pnn-green/10 border-pnn-green/20 text-pnn-green-dark'
                            : 'bg-border-subtle/30 border-border-subtle text-txt-muted'
                        }`}>
                          {twoFa.data.enabled ? '🔒 Email OTP' : '—'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5 justify-end">
                        <button type="button" onClick={() => openEdit(u)}
                          className="text-xs px-3 py-1.5 border border-pnn-blue/40 text-pnn-blue rounded-lg hover:bg-pnn-blue/10 transition">
                          Editar
                        </button>
                        <button type="button"
                          onClick={() => window.confirm(`¿Eliminar al usuario ${u.nombre} (${u.email})?`) && remove.mutate(u.id)}
                          disabled={u.id === me?.id}
                          className="text-xs px-3 py-1.5 border border-accent-red/40 text-accent-red rounded-lg hover:bg-accent-red/10 transition disabled:opacity-30">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-border-subtle">
              {list.isLoading && <div className="p-4 text-xs text-txt-light">Cargando…</div>}
              {list.data?.map((u) => (
                <div key={u.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-pnn-green/10 grid place-items-center text-pnn-green-dark font-bold text-xs shrink-0">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-txt truncate">{u.nombre}</div>
                        <div className="text-[11px] font-mono text-txt-muted truncate">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`h-1.5 w-1.5 rounded-full ${u.activo ? 'bg-pnn-green' : 'bg-txt-muted'}`} />
                      <span className={ROL_CHIP[u.rol]}>{u.rol}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(u)}
                      className="flex-1 text-xs py-2 border border-pnn-blue/40 text-pnn-blue rounded-lg hover:bg-pnn-blue/10 touch-target">
                      Editar
                    </button>
                    <button type="button"
                      onClick={() => window.confirm(`¿Eliminar a ${u.nombre}?`) && remove.mutate(u.id)}
                      disabled={u.id === me?.id}
                      className="text-xs py-2 px-4 border border-accent-red/40 text-accent-red rounded-lg hover:bg-accent-red/10 disabled:opacity-30 touch-target">
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </section>
        </div>
      </main>
    </div>
  );
}
