import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token: string | null): Socket {
  if (socket && socket.connected) return socket;
  socket?.disconnect();
  socket = io(import.meta.env.VITE_WS_URL ?? '/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
