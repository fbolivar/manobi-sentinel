import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth.store';

describe('auth.store', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  });

  it('setTokens guarda el usuario y tokens', () => {
    useAuthStore.getState().setTokens('at-1', 'rt-1', {
      id: 'u1', email: 'x@y.com', nombre: 'Ana', rol: 'admin',
    } as never);
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('at-1');
    expect(s.refreshToken).toBe('rt-1');
    expect(s.user?.rol).toBe('admin');
  });

  it('logout limpia estado', () => {
    useAuthStore.getState().setTokens('at', 'rt', { id: 'u', email: 'a', nombre: 'A', rol: 'consulta' } as never);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
