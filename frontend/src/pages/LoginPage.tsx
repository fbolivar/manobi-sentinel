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
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-pnn-green via-pnn-green-dark to-pnn-forest flex-col justify-between p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5 L55 50 L5 50 Z\' fill=\'none\' stroke=\'white\' stroke-width=\'0.5\'/%3E%3C/svg%3E")', backgroundSize: '60px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur grid place-items-center text-2xl font-bold">M</div>
            <div>
              <div className="text-xl font-bold tracking-wide">Manobi Sentinel</div>
              <div className="text-sm text-white/70">Sistema de Alerta Temprana</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold leading-tight">Protegiendo los<br />Parques Nacionales<br />de Colombia</h2>
          <p className="text-white/70 text-sm max-w-sm">Monitoreo satelital en tiempo real de 73 áreas protegidas con inteligencia artificial y datos IDEAM.</p>
          <div className="flex gap-4 text-xs text-white/60">
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/80" /> 8 fuentes de datos</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/80" /> IA predictiva</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/80" /> 24/7</div>
          </div>
        </div>
        <div className="relative z-10 text-xs text-white/40">
          Parques Nacionales Naturales de Colombia<br />
          Ministerio de Ambiente y Desarrollo Sostenible
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-bg">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-4">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="h-11 w-11 rounded-xl bg-pnn-green grid place-items-center text-white text-xl font-bold">M</div>
              <div className="text-left">
                <div className="text-lg font-bold text-txt">Manobi Sentinel</div>
                <div className="text-xs text-txt-muted">PNN Colombia</div>
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-txt">Iniciar sesión</h1>
            <p className="text-sm text-txt-muted mt-1">Ingrese sus credenciales para acceder al sistema</p>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-txt-muted uppercase tracking-wider">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@parquesnacionales.gov.co"
              className="input-field mt-1.5" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-txt-muted uppercase tracking-wider">Contraseña</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="input-field mt-1.5" />
          </label>

          {error && (
            <div className="flex items-center gap-2 text-sm text-accent-red bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <span>⚠</span> {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Autenticando…' : 'Iniciar sesión'}
          </button>

          <div className="flex items-center justify-center gap-2 pt-2">
            <span className={`h-2 w-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-accent-green'}`} />
            <span className="text-xs text-txt-light">Sistema operativo</span>
          </div>

          <p className="text-[11px] text-txt-light text-center pt-4 border-t border-border-subtle">
            Acceso restringido — Sistema gubernamental monitoreado
          </p>
        </form>
      </div>
    </div>
  );
}
