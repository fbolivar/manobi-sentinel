import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

const MAIN_ITEMS = [
  { to: '/dashboard',      label: 'Mapa',    icon: '🗺' },
  { to: '/estado-parques', label: 'Estado',  icon: '🛡' },
  { to: '/parques',        label: 'Parques', icon: '🌿' },
  { to: '/reportes',       label: 'Reportes',icon: '📄' },
];

const SISTEMA_ROUTES = [
  { to: '/historico',      label: 'Histórico',                    icon: '🔔' },
  { to: '/eventos',        label: 'Eventos',                      icon: '🌩' },
  { to: '/alertas-hidro',  label: 'Alertas Hidrometeorológicas',  icon: '💧' },
  { to: '/areas-quemadas', label: 'Áreas Quemadas',               icon: '🔥' },
  { to: '/suscripciones',  label: 'Suscripciones',                icon: '📬' },
  { to: '/reglas',         label: 'Reglas',                       icon: '⚙️' },
];

const ADMIN_ROUTES = [
  { to: '/usuarios',       label: 'Usuarios',     icon: '👥' },
  { to: '/auditoria',      label: 'Auditoría',    icon: '📋' },
  { to: '/backups',        label: 'Respaldos',     icon: '💾' },
  { to: '/integraciones',  label: 'Integraciones', icon: '🔌' },
];

const SISTEMA_PATHS = [...SISTEMA_ROUTES, ...ADMIN_ROUTES].map((r) => r.to);

export function MobileNav() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isSistemaActive = SISTEMA_PATHS.some((p) => location.pathname.startsWith(p));

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center py-2 px-1 min-w-[48px] text-[10px] font-medium transition-colors ${
      isActive ? 'text-pnn-green' : 'text-txt-muted'
    }`;

  const sheetItemCls = 'flex items-center gap-3 px-4 py-3 text-sm text-txt hover:bg-bg-surface2 active:bg-bg-surface2 transition-colors rounded-lg';

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-bg-surface/95 backdrop-blur border-t border-border-subtle safe-bottom">
        <div className="flex justify-around">
          {MAIN_ITEMS.map((it) => (
            <NavLink key={it.to} to={it.to} className={linkCls}>
              <span className="text-lg leading-none">{it.icon}</span>
              <span className="mt-0.5">{it.label}</span>
            </NavLink>
          ))}

          {/* Botón Más */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`flex flex-col items-center py-2 px-1 min-w-[48px] text-[10px] font-medium transition-colors ${
              isSistemaActive ? 'text-pnn-green' : 'text-txt-muted'
            }`}
          >
            <span className="text-lg leading-none">☰</span>
            <span className="mt-0.5">Más</span>
          </button>
        </div>
      </nav>

      {/* Bottom sheet overlay */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 inset-x-0 z-[70] bg-bg-surface rounded-t-2xl shadow-2xl safe-bottom">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border-subtle" />
            </div>

            <div className="px-3 pb-4 max-h-[70vh] overflow-y-auto">
              <p className="text-[10px] font-mono text-txt-muted px-1 py-2 tracking-wider">SISTEMA</p>
              <div className="space-y-0.5">
                {SISTEMA_ROUTES.map((it) => (
                  <NavLink
                    key={it.to} to={it.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `${sheetItemCls} ${isActive ? 'bg-pnn-green/10 text-pnn-green-dark font-semibold' : ''}`
                    }
                  >
                    <span className="text-base w-6 text-center">{it.icon}</span>
                    {it.label}
                  </NavLink>
                ))}
              </div>

              {user?.rol === 'admin' && (
                <>
                  <p className="text-[10px] font-mono text-txt-muted px-1 py-2 mt-2 tracking-wider border-t border-border-subtle pt-3">ADMINISTRACIÓN</p>
                  <div className="space-y-0.5">
                    {ADMIN_ROUTES.map((it) => (
                      <NavLink
                        key={it.to} to={it.to}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `${sheetItemCls} ${isActive ? 'bg-pnn-green/10 text-pnn-green-dark font-semibold' : ''}`
                        }
                      >
                        <span className="text-base w-6 text-center">{it.icon}</span>
                        {it.label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
