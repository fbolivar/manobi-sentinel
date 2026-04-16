import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './LoginPage';

vi.mock('../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn(), interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } } }));

function wrap(ui: React.ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('LoginPage', () => {
  it('renderiza formulario de login', () => {
    render(wrap(<LoginPage />));
    expect(screen.getByText('Manobi Sentinel')).toBeInTheDocument();
    expect(screen.getByText('INICIAR SESIÓN')).toBeInTheDocument();
  });

  it('tiene campos email y contraseña', () => {
    render(wrap(<LoginPage />));
    expect(screen.getByText('EMAIL')).toBeInTheDocument();
    expect(screen.getByText('CONTRASEÑA')).toBeInTheDocument();
  });
});
