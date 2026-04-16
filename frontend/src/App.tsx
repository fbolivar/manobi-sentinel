import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportesPage } from './pages/ReportesPage';
import { SuscripcionesPage } from './pages/SuscripcionesPage';
import { ReglasPage } from './pages/ReglasPage';
import { UsuariosPage } from './pages/UsuariosPage';
import { HistoricoPage } from './pages/HistoricoPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileNav } from './components/layout/MobileNav';
import { useAuthStore } from './stores/auth.store';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/reportes" element={<Protected><ReportesPage /></Protected>} />
          <Route path="/suscripciones" element={<Protected><SuscripcionesPage /></Protected>} />
          <Route path="/reglas" element={<Protected><ReglasPage /></Protected>} />
          <Route path="/usuarios" element={<Protected><UsuariosPage /></Protected>} />
          <Route path="/historico" element={<Protected><HistoricoPage /></Protected>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <MobileNav />
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
