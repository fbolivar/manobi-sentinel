import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import type { User } from '../types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string, user: User) => void;
  logout: () => void;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (access, refresh, user) =>
        set({ accessToken: access, refreshToken: refresh, user }),
      logout: () => {
        const { accessToken, refreshToken } = get();
        if (accessToken && refreshToken) {
          // Revoca el refresh token en el servidor; no bloqueamos el logout local si falla.
          axios.post(
            `${API_BASE}/auth/logout`,
            { refresh_token: refreshToken },
            { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 5_000 },
          ).catch(() => {});
        }
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: 'manobi-auth' },
  ),
);
