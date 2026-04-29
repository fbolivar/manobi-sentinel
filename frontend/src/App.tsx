import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileNav } from './components/layout/MobileNav';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './stores/auth.store';

// Code-splitting: cada página se carga on-demand como chunk independiente.
// LoginPage permanece eager porque es la entrada sin sesión.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ReportesPage = lazy(() => import('./pages/ReportesPage').then((m) => ({ default: m.ReportesPage })));
const SuscripcionesPage = lazy(() => import('./pages/SuscripcionesPage').then((m) => ({ default: m.SuscripcionesPage })));
const ReglasPage = lazy(() => import('./pages/ReglasPage').then((m) => ({ default: m.ReglasPage })));
const UsuariosPage = lazy(() => import('./pages/UsuariosPage').then((m) => ({ default: m.UsuariosPage })));
const HistoricoPage = lazy(() => import('./pages/HistoricoPage').then((m) => ({ default: m.HistoricoPage })));
const BackupsPage = lazy(() => import('./pages/BackupsPage').then((m) => ({ default: m.BackupsPage })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function PageFallback() {
  return (
    <div className="h-screen grid place-items-center bg-bg">
      <div className="text-txt-muted text-sm font-mono">Cargando…</div>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
            <Route path="/reportes" element={<Protected><ReportesPage /></Protected>} />
            <Route path="/suscripciones" element={<Protected><SuscripcionesPage /></Protected>} />
            <Route path="/reglas" element={<Protected><ReglasPage /></Protected>} />
            <Route path="/usuarios" element={<Protected><UsuariosPage /></Protected>} />
            <Route path="/historico" element={<Protected><HistoricoPage /></Protected>} />
            <Route path="/backups" element={<Protected><BackupsPage /></Protected>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
        <MobileNav />
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
