import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import type { LoginResponse } from '../types';

export function LoginPage() {
  const [email, setEmail] = useState('admin@manobi.local');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setTokens = useAuthStore((s) => s.setTokens);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
      setTokens(data.access_token, data.refresh_token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Error de autenticación');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="panel w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-accent-green animate-pulse"></div>
            <span className="text-xs font-mono tracking-widest text-accent-green">SYSTEM ONLINE</span>
          </div>
          <h1 className="text-3xl font-bold">Manobi Sentinel</h1>
          <p className="text-sm text-white/60 mt-1">Parques Nacionales Naturales de Colombia</p>
        </div>

        <label className="block mb-4">
          <span className="text-xs font-mono text-white/60">EMAIL</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono focus:border-accent-blue outline-none" />
        </label>
        <label className="block mb-6">
          <span className="text-xs font-mono text-white/60">CONTRASEÑA</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono focus:border-accent-blue outline-none" />
        </label>

        {error && <div className="mb-4 text-sm text-accent-red border border-accent-red/40 bg-accent-red/10 rounded px-3 py-2">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full bg-accent-green text-bg font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50 transition">
          {loading ? 'Autenticando…' : 'INICIAR SESIÓN'}
        </button>

        <p className="mt-6 text-[10px] font-mono text-white/40 text-center">
          Acceso restringido — Sistema gubernamental monitoreado
        </p>
      </form>
    </div>
  );
}
