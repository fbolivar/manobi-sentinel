import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../stores/auth.store';

export function useAlertsSocket(onAlert?: (a: unknown) => void) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  useEffect(() => {
    if (!token) return;
    const s = getSocket(token);
    const handler = (data: unknown) => {
      qc.invalidateQueries({ queryKey: ['alertas'] });
      qc.invalidateQueries({ queryKey: ['alertas-summary'] });
      onAlert?.(data);
    };
    s.on('alerta', handler);
    return () => { s.off('alerta', handler); };
  }, [token, qc, onAlert]);
}
