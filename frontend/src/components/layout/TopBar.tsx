import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

const SISTEMA_ROUTES = ['/historico', '/eventos', '/suscripciones', '/reglas', '/usuarios', '/auditoria', '/backups'];

function SistemaMenu({ user }: { user: { rol: string } | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isActive = SISTEMA_ROUTES.some((r) => location.pathname.startsWith(r));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const itemCls = 'flex items-center gap-2 px-4 py-2 text-xs text-txt-muted hover:text-txt hover:bg-bg-surface2 transition whitespace-nowrap';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition whitespace-nowrap ${
          isActive
            ? 'bg-pnn-green/10 text-pnn-green-dark border border-pnn-green/30'
            : 'text-txt-muted hover:text-txt hover:bg-bg-surface2'
        }`}
      >
        Sistema
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 bg-bg-surface border border-border-subtle rounded-lg shadow-lg z-50 py-1 min-w-[170px]"
          onClick={() => setOpen(false)}
        >
          <NavLink to="/historico" className={itemCls}>Histórico</NavLink>
          <NavLink to="/eventos" className={itemCls}>Eventos</NavLink>
          <NavLink to="/suscripciones" className={itemCls}>Suscripciones</NavLink>
          <NavLink to="/reglas" className={itemCls}>Reglas</NavLink>
          {(user?.rol === 'admin' || user?.rol === 'operador') && (
            <div className="border-t border-border-subtle my-1" />
          )}
          {user?.rol === 'admin' && <NavLink to="/usuarios" className={itemCls}>Usuarios</NavLink>}
          {user?.rol === 'admin' && <NavLink to="/auditoria" className={itemCls}>Auditoría</NavLink>}
          {user?.rol === 'admin' && <NavLink to="/backups" className={itemCls}>Respaldos</NavLink>}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const now = useClock();
  const { user, logout } = useAuthStore();

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
        <NavLink to="/estado-parques" className={linkCls}>Estado Áreas</NavLink>
        <NavLink to="/parques" className={linkCls}>Parques</NavLink>
        <NavLink to="/reportes" className={linkCls}>Reportes</NavLink>
        <SistemaMenu user={user} />
      </nav>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="md:hidden">
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
          className="group h-8 w-8 rounded-lg border border-border-subtle hover:border-accent-red/60 hover:bg-accent-red/10 text-txt-muted hover:text-accent-red grid place-items-center transition touch-target"
          title="Cerrar sesión" aria-label="Cerrar sesión">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform group-hover:translate-x-0.5">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
