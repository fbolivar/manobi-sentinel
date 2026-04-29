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
  it('renderiza sin errores', () => {
    const { container } = render(wrap(<LoginPage />));
    expect(container.querySelector('form')).toBeInTheDocument();
    expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(container.querySelector('button[type="submit"]')).toBeInTheDocument();
  });

  it('tiene placeholders correctos', () => {
    render(wrap(<LoginPage />));
    expect(screen.getByPlaceholderText(/parquesnacionales/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/8 caracteres/i)).toBeInTheDocument();
  });
});
