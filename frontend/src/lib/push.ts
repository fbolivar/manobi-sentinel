import { api } from './api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(raw);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('SW register fail', e);
    return null;
  }
}

export async function subscribeToPush(niveles: ('verde' | 'amarillo' | 'rojo')[] = ['rojo', 'amarillo']) {
  const reg = await registerServiceWorker();
  if (!reg || !('PushManager' in window)) throw new Error('Push no soportado');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso denegado');

  const { data } = await api.get<{ key: string | null }>('/push/vapid-public-key');
  if (!data.key) throw new Error('Servidor sin VAPID configurado');

  const existing = await reg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.key) as BufferSource,
  });
  await api.post('/push/subscribe', { subscription: sub.toJSON(), niveles });
  return sub;
}
