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
    `px-3 py-1 rounded text-xs font-mono tracking-wider uppercase transition ${
      isActive ? 'bg-accent-green/10 text-accent-green border border-accent-green/40' : 'text-white/60 hover:text-white'
    }`;

  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-border-subtle bg-bg-surface/60 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-accent-green/20 border border-accent-green grid place-items-center font-bold text-accent-green">M</div>
          <div>
            <div className="text-sm font-bold tracking-wider">MANOBI SENTINEL</div>
            <div className="text-[10px] font-mono text-white/50">PNN COLOMBIA · ALERTA TEMPRANA</div>
          </div>
        </div>
        <nav className="flex items-center gap-1 ml-4 overflow-x-auto scrollbar-hide">
          <NavLink to="/dashboard" className={linkCls}>Dashboard</NavLink>
          <NavLink to="/historico" className={linkCls}>Histórico</NavLink>
          <NavLink to="/reportes" className={linkCls}>Reportes</NavLink>
          <NavLink to="/suscripciones" className={linkCls}>Suscripciones</NavLink>
          <NavLink to="/reglas" className={linkCls}>Reglas</NavLink>
          {user?.rol === 'admin' && <NavLink to="/usuarios" className={linkCls}>Usuarios</NavLink>}
        </nav>
      </div>

      <div className="hidden md:flex items-center gap-4 text-xs font-mono">
        <span className="flex items-center gap-1.5"><Dot ok={apiHealth.isSuccess} /> API</span>
        <span className="flex items-center gap-1.5"><Dot ok={apiHealth.isSuccess} /> DB</span>
        <span className="flex items-center gap-1.5"><Dot ok={apiHealth.isSuccess} /> IA</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="font-mono text-sm text-accent-green">{time}</div>
          <div className="text-[10px] text-white/50 uppercase">{date} · UTC-5</div>
        </div>
        {user && (
          <div className="flex items-center gap-2 pl-4 border-l border-border-subtle">
            <div className="text-right leading-tight">
              <div className="text-xs">{user.nombre}</div>
              <div className="text-[10px] font-mono uppercase text-accent-blue">{user.rol}</div>
            </div>
            <button onClick={logout} className="text-xs px-2 py-1 border border-border-subtle rounded hover:bg-bg-surface2" title="Cerrar sesión">⎋</button>
          </div>
        )}
      </div>
    </header>
  );
}
