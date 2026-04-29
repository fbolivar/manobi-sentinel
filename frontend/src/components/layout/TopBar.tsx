import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

interface HealthData {
  status: string;
  checks?: { db: 'ok' | 'error'; redis: 'ok' | 'error'; ia: 'ok' | 'error' };
}

interface IdeamStatusData {
  ultimo_poll: string | null;
  ultimo_total: number;
  ultimo_modo: string;
  proximo_poll: string;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

function Dot({ ok, title }: { ok: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-accent-green' : 'bg-accent-red animate-pulse'}`}
    />
  );
}

function fmt(iso: string | null) {
  if (!iso) return 'nunca';
  return new Date(iso).toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
}

export function TopBar() {
  const now = useClock();
  const { user, logout } = useAuthStore();

  const health = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: async () => (await api.get('/health', { baseURL: '/' })).data,
    refetchInterval: 15_000,
  });

  const ideamStatus = useQuery<IdeamStatusData>({
    queryKey: ['ideam-status'],
    queryFn: async () => (await api.get('/ideam/status')).data,
    refetchInterval: 60_000,
    enabled: user?.rol === 'admin' || user?.rol === 'operador',
  });

  const checks = health.data?.checks;
  const dbOk = checks?.db === 'ok';
  const redisOk = checks?.redis === 'ok';
  const iaOk = checks?.ia === 'ok';
  const apiOk = health.isSuccess;

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
        <NavLink to="/estado-parques" className={linkCls}>Estado Áreas</NavLink>
        <NavLink to="/parques" className={linkCls}>Parques</NavLink>
        <NavLink to="/eventos" className={linkCls}>Eventos</NavLink>
        <NavLink to="/reportes" className={linkCls}>Reportes</NavLink>
        <NavLink to="/suscripciones" className={linkCls}>Suscripciones</NavLink>
        <NavLink to="/reglas" className={linkCls}>Reglas</NavLink>
        {user?.rol === 'admin' && <NavLink to="/usuarios" className={linkCls}>Usuarios</NavLink>}
        {user?.rol === 'admin' && <NavLink to="/auditoria" className={linkCls}>Auditoría</NavLink>}
        {user?.rol === 'admin' && <NavLink to="/backups" className={linkCls}>Respaldos</NavLink>}
      </nav>

      {/* Status — desktop */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-txt-muted">
        <span className="flex items-center gap-1.5" title="Estado del API">
          <Dot ok={apiOk} title="API" /> API
        </span>
        <span className="flex items-center gap-1.5" title={`Base de datos: ${dbOk ? 'OK' : 'Error'}`}>
          <Dot ok={dbOk} title="DB" /> DB
        </span>
        <span className="flex items-center gap-1.5" title={`Redis: ${redisOk ? 'OK' : 'Error'}`}>
          <Dot ok={redisOk} title="Redis" /> Redis
        </span>
        <span className="flex items-center gap-1.5" title={`IA: ${iaOk ? 'OK' : 'No disponible'}`}>
          <Dot ok={iaOk} title="IA" /> IA
        </span>
        {ideamStatus.data && (
          <span
            className="flex items-center gap-1 border-l border-border-subtle pl-3 text-[10px] font-mono"
            title={`IDEAM: último poll ${fmt(ideamStatus.data.ultimo_poll)} — ${ideamStatus.data.ultimo_total} eventos (${ideamStatus.data.ultimo_modo})`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${ideamStatus.data.ultimo_poll ? 'bg-pnn-blue' : 'bg-txt-muted'}`} />
            IDEAM {fmt(ideamStatus.data.ultimo_poll)}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="md:hidden flex items-center gap-2">
          <Dot ok={apiOk} />
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
