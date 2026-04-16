import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-accent-green' : 'bg-accent-red animate-pulse'}`} />;
}

export function TopBar() {
  const now = useClock();
  const { user, logout } = useAuthStore();
  const apiHealth = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get('/health', { baseURL: '/' })).data,
    refetchInterval: 15_000,
  });

  const time = now.toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' });
  const date = now.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition whitespace-nowrap ${
      isActive ? 'bg-pnn-green/10 text-pnn-green-dark border border-pnn-green/30' : 'text-txt-muted hover:text-txt hover:bg-bg-surface2'
    }`;

  return (
    <header className="h-12 md:h-14 px-3 md:px-5 flex items-center justify-between border-b border-border-subtle bg-bg-surface shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <img src="/logo.png" alt="Manobi" className="h-8 w-8 rounded-lg object-cover" />
        <div className="hidden sm:block">
          <div className="text-sm font-bold text-txt tracking-wide">MANOBI SENTINEL</div>
          <div className="text-[10px] text-txt-light">PNN Colombia</div>
        </div>
        <span className="sm:hidden text-xs font-bold text-txt tracking-wide">SENTINEL</span>
      </div>

      {/* Nav — desktop */}
      <nav className="hidden md:flex items-center gap-1 mx-4 overflow-x-auto scrollbar-hide">
        <NavLink to="/dashboard" className={linkCls}>Dashboard</NavLink>
        <NavLink to="/historico" className={linkCls}>Histórico</NavLink>
        <NavLink to="/reportes" className={linkCls}>Reportes</NavLink>
        <NavLink to="/suscripciones" className={linkCls}>Suscripciones</NavLink>
        <NavLink to="/reglas" className={linkCls}>Reglas</NavLink>
        {user?.rol === 'admin' && <NavLink to="/usuarios" className={linkCls}>Usuarios</NavLink>}
      </nav>

      {/* Status — desktop */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-txt-muted">
        <span className="flex items-center gap-1.5"><Dot ok={apiHealth.isSuccess} /> API</span>
        <span className="flex items-center gap-1.5"><Dot ok={apiHealth.isSuccess} /> DB</span>
        <span className="flex items-center gap-1.5"><Dot ok={apiHealth.isSuccess} /> IA</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="md:hidden flex items-center gap-2">
          <Dot ok={apiHealth.isSuccess} />
          <span className="font-mono text-xs text-pnn-green font-semibold">{time}</span>
        </div>
        <div className="hidden md:block text-right leading-tight">
          <div className="font-mono text-sm text-pnn-green font-semibold">{time}</div>
          <div className="text-[10px] text-txt-light uppercase">{date}</div>
        </div>
        {user && (
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-border-subtle">
            <div className="h-8 w-8 rounded-full bg-pnn-green/10 grid place-items-center text-pnn-green-dark text-xs font-bold">
              {user.nombre?.charAt(0).toUpperCase()}
            </div>
            <div className="text-right leading-tight">
              <div className="text-xs font-medium text-txt">{user.nombre?.split(' ')[0]}</div>
              <div className="text-[10px] text-txt-light uppercase">{user.rol}</div>
            </div>
          </div>
        )}
        <button type="button" onClick={logout}
          className="h-8 w-8 rounded-lg border border-border-subtle hover:bg-bg-surface2 text-txt-muted grid place-items-center text-sm transition touch-target"
          title="Cerrar sesión" aria-label="Cerrar sesión">⎋</button>
      </div>
    </header>
  );
}
