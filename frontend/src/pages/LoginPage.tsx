import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import type { LoginResponse } from '../types';

export function LoginPage() {
  const [email, setEmail] = useState('');
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
    <div className="min-h-screen grid place-items-center px-4 py-10 bg-gradient-to-br from-white via-white to-pnn-green/5 relative overflow-hidden">
      {/* Blobs decorativos muy sutiles */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-pnn-green/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-pnn-blue/10 blur-3xl" aria-hidden />

      <main className="relative w-full max-w-md">
        {/* Header con logo + nombre */}
        <header className="flex flex-col items-center text-center mb-6">
          <img src="/logo.png" alt="" className="h-14 w-14 rounded-2xl object-cover shadow-md ring-1 ring-black/5 mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-txt">Manobi Sentinel</h1>
          <p className="text-xs text-txt-muted mt-1">Sistema de Alerta Temprana · PNN Colombia</p>
        </header>

        {/* Card con formulario */}
        <form onSubmit={submit}
          className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-7 sm:p-8 space-y-5">
          <h2 className="text-lg font-semibold text-txt">Iniciar sesión</h2>

          <label className="block">
            <span className="text-[11px] font-medium text-txt-muted uppercase tracking-wider">Email institucional</span>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@parquesnacionales.gov.co"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-txt
                         placeholder:text-gray-400
                         focus:border-pnn-green focus:ring-2 focus:ring-pnn-green/20 focus:outline-none
                         transition" />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-txt-muted uppercase tracking-wider">Contraseña</span>
            <input
              type="password" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-txt
                         placeholder:text-gray-400
                         focus:border-pnn-green focus:ring-2 focus:ring-pnn-green/20 focus:outline-none
                         transition" />
          </label>

          {error && (
            <div role="alert"
              className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              <span aria-hidden>⚠</span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="group w-full bg-pnn-green text-white font-semibold text-sm py-2.5 rounded-lg
                       hover:brightness-110 active:brightness-95
                       disabled:opacity-60 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 transition">
            {loading ? 'Autenticando…' : (
              <>
                Ingresar
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer institucional */}
        <footer className="mt-6 text-center space-y-1">
          <p className="text-[11px] text-txt-muted">
            Parques Nacionales Naturales de Colombia
            <span className="mx-1.5 text-gray-300">·</span>
            Ministerio de Ambiente y Desarrollo Sostenible
          </p>
          <p className="text-[10px] text-txt-light flex items-center justify-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Acceso restringido · Sistema gubernamental monitoreado
          </p>
        </footer>
      </main>
    </div>
  );
}
