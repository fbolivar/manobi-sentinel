import { create } from 'zustand';

export type ToastKind = 'error' | 'success' | 'info';
export interface Toast { id: string; kind: ToastKind; message: string; }

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, ttlMs?: number) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message, ttlMs = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    if (ttlMs > 0) setTimeout(() => get().dismiss(id), ttlMs);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  error: (m: string) => useToastStore.getState().push('error', m, 7000),
  success: (m: string) => useToastStore.getState().push('success', m, 4000),
  info: (m: string) => useToastStore.getState().push('info', m, 4000),
};
