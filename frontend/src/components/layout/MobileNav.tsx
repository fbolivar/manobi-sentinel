import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

const items = [
  { to: '/dashboard', label: 'Mapa', icon: '🗺' },
  { to: '/historico', label: 'Alertas', icon: '🔔' },
  { to: '/estado-parques', label: 'Estado', icon: '🛡' },
  { to: '/parques', label: 'Parques', icon: '🌿' },
  { to: '/eventos', label: 'Eventos', icon: '🌦' },
];

export function MobileNav() {
  const user = useAuthStore((s) => s.user);
  const all = user?.rol === 'admin'
    ? [...items, { to: '/usuarios', label: 'Usuarios', icon: '👤' }, { to: '/auditoria', label: 'Auditoría', icon: '🔍' }]
    : items;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-bg-surface/95 backdrop-blur border-t border-border-subtle safe-bottom">
      <div className="flex justify-around">
        {all.map((it) => (
          <NavLink key={it.to} to={it.to}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-1 min-w-[48px] text-[10px] font-medium transition-colors ${
                isActive ? 'text-pnn-green' : 'text-txt-muted'
              }`
            }>
            <span className="text-lg leading-none">{it.icon}</span>
            <span className="mt-0.5">{it.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
