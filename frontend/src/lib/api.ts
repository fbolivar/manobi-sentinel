import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 60_000,
});

api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

type Pending = { resolve: (t: string) => void; reject: (e: unknown) => void };
let refreshInFlight: Promise<string> | null = null;
const queue: Pending[] = [];

async function doRefresh(): Promise<string> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) { logout(); throw new Error('no-refresh'); }
  try {
    const { data } = await axios.post(
      `${api.defaults.baseURL}/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 10_000 },
    );
    setTokens(data.access_token, data.refresh_token, data.user);
    queue.splice(0).forEach((p) => p.resolve(data.access_token));
    return data.access_token as string;
  } catch (e) {
    queue.splice(0).forEach((p) => p.reject(e));
    useAuthStore.getState().logout();
    throw e;
  } finally {
    refreshInFlight = null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const cfg = err.config as InternalAxiosRequestConfig & { __retry?: boolean };
    if (err.response?.status !== 401 || !cfg || cfg.__retry) throw err;
    cfg.__retry = true;

    const tokenP = refreshInFlight
      ? new Promise<string>((resolve, reject) => queue.push({ resolve, reject }))
      : (refreshInFlight = doRefresh());

    const newToken = await tokenP;
    cfg.headers = cfg.headers ?? {} as InternalAxiosRequestConfig['headers'];
    (cfg.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
    return api(cfg);
  },
);
