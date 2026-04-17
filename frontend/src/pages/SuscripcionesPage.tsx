import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { subscribeToPush } from '../lib/push';
import { TopBar } from '../components/layout/TopBar';
import type { Parque } from '../types';

interface Suscripcion {
  id: string;
  parque_id: string | null;
  niveles: string[];
  canal: 'email' | 'webhook' | 'push';
  destino: string | null;
  activa: boolean;
  creado_en: string;
}

export function SuscripcionesPage() {
  const qc = useQueryClient();
  const [canal, setCanal] = useState<'email' | 'webhook' | 'push'>('email');
  const [destino, setDestino] = useState('');
  const [parque, setParque] = useState('');
  const [niveles, setNiveles] = useState<string[]>(['rojo']);

  const subs = useQuery<Suscripcion[]>({
    queryKey: ['suscripciones'],
    queryFn: async () => (await api.get('/suscripciones')).data,
  });

  const parques = useQuery<Parque[]>({
    queryKey: ['parques'],
    queryFn: async () => (await api.get('/parques')).data,
    staleTime: 5 * 60_000,
  });

  const crear = useMutation({
    mutationFn: async () => (await api.post('/suscripciones', {
      canal, destino: destino || undefined,
      parque_id: parque || undefined, niveles,
    })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suscripciones'] }); setDestino(''); setParque(''); },
  });

  const toggleActiva = useMutation({
    mutationFn: async (s: Suscripcion) =>
      (await api.patch(`/suscripciones/${s.id}`, { canal: s.canal, niveles: s.niveles, activa: !s.activa })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suscripciones'] }),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/suscripciones/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suscripciones'] }),
  });

  const toggleNivel = (n: string) =>
    setNiveles((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const parqueNombre = (id: string | null) =>
    id ? parques.data?.find((p) => p.id === id)?.nombre ?? id.slice(0, 8) : 'Todos';

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-4 grid gap-4 grid-cols-1 md:grid-cols-[380px_1fr]">
        <aside className="panel p-4 space-y-3 h-fit">
          <h2 className="text-sm font-bold tracking-wider">NUEVA SUSCRIPCIÓN</h2>
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">CANAL</span>
            <select value={canal} onChange={(e) => setCanal(e.target.value as 'email' | 'webhook' | 'push')}
              title="Canal" aria-label="Canal"
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono">
              <option value="email">Email</option>
              <option value="webhook">Webhook (HTTP POST)</option>
              <option value="push">Push (navegador)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">DESTINO {canal === 'email' ? '(email)' : canal === 'webhook' ? '(URL)' : '(endpoint)'}</span>
            <input value={destino} onChange={(e) => setDestino(e.target.value)}
              placeholder={canal === 'email' ? 'ops@parques.gov.co' : canal === 'webhook' ? 'https://hooks.slack.com/…' : '(auto)'}
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-xs" />
          </label>
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">PARQUE (opcional — todos si vacío)</span>
            <select value={parque} onChange={(e) => setParque(e.target.value)}
              title="Parque" aria-label="Parque"
              className="mt-1 w-full bg-bg-surface2 border border-border-subtle rounded px-3 py-2 font-mono text-xs">
              <option value="">— Todos —</option>
              {parques.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <div>
            <div className="text-xs font-mono text-txt-muted mb-1">NIVELES</div>
            <div className="flex gap-2">
              {(['rojo', 'amarillo', 'verde'] as const).map((n) => (
                <label key={n} className={`cursor-pointer chip chip-${n === 'rojo' ? 'rojo' : n === 'amarillo' ? 'amarillo' : 'verde'} ${niveles.includes(n) ? '' : 'opacity-40'}`}>
                  <input type="checkbox" className="hidden" checked={niveles.includes(n)} onChange={() => toggleNivel(n)} />
                  {n.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
          <button onClick={() => crear.mutate()} disabled={crear.isPending || niveles.length === 0}
            className="w-full bg-accent-green text-bg font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50">
            {crear.isPending ? 'Creando…' : 'CREAR SUSCRIPCIÓN'}
          </button>
          <button
            onClick={async () => {
              try { await subscribeToPush(niveles as ('verde' | 'amarillo' | 'rojo')[]); qc.invalidateQueries({ queryKey: ['suscripciones'] }); }
              catch (e) { alert('Push: ' + (e as Error).message); }
            }}
            disabled={location.protocol !== 'https:' || location.hostname === 'localhost'}
            className="w-full border border-pnn-blue text-pnn-blue py-2 rounded hover:bg-pnn-blue/10 text-xs font-mono disabled:opacity-30 disabled:cursor-not-allowed"
            title={location.protocol !== 'https:' ? 'Requiere certificado SSL válido' : ''}>
            🔔 NOTIFICACIONES PUSH
          </button>
          {location.protocol !== 'https:' && (
            <div className="text-[10px] text-txt-light">Push requiere certificado SSL válido</div>
          )}
          <Link to="/dashboard" className="block text-xs text-txt-muted hover:text-pnn-blue">← Volver al dashboard</Link>
        </aside>

        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-sm font-bold tracking-wider">MIS SUSCRIPCIONES ({subs.data?.length ?? 0})</h2>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-border-subtle">
            {subs.isLoading && (
              <div className="p-6 text-center text-txt-light text-xs">Cargando suscripciones…</div>
            )}
            {!subs.isLoading && subs.data?.length === 0 && (
              <div className="p-6 text-center text-txt-light text-xs">Sin suscripciones. Crea una en el panel izquierdo.</div>
            )}
            {subs.data?.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${s.activa ? 'bg-accent-green animate-pulse' : 'bg-white/20'}`} />
                <div className="flex-1">
                  <div className="text-sm">{parqueNombre(s.parque_id)}</div>
                  <div className="text-[10px] font-mono text-txt-muted">
                    {s.canal.toUpperCase()} → {s.destino ?? '(sin destino)'}
                  </div>
                </div>
                <div className="flex gap-1">
                  {s.niveles.map((n) => (
                    <span key={n} className={`chip chip-${n === 'rojo' ? 'rojo' : n === 'amarillo' ? 'amarillo' : 'verde'}`}>{n[0].toUpperCase()}</span>
                  ))}
                </div>
                <button onClick={() => toggleActiva.mutate(s)}
                  className="text-xs px-2 py-1 border border-border-subtle rounded hover:bg-bg-surface2">
                  {s.activa ? 'Pausar' : 'Reactivar'}
                </button>
                <button onClick={() => eliminar.mutate(s.id)}
                  className="text-xs px-2 py-1 border border-accent-red/50 text-accent-red rounded hover:bg-accent-red/10">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
