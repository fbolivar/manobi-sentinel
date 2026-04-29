import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';
import { useAuthStore } from '../stores/auth.store';

interface BackupItem {
  id: string;
  filename: string;
  size: number;
  tipo: string;
  creado_en: string;
  creado_por: string;
  encrypted: boolean;
  app_version: string;
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function BackupsPage() {
  const qc = useQueryClient();
  const rol = useAuthStore((s) => s.user?.rol);
  const [password, setPassword] = useState('');
  const [useEncryption, setUseEncryption] = useState(true);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);
  const [selected, setSelected] = useState<BackupItem | null>(null);
  const [modalMode, setModalMode] = useState<'' | 'verify' | 'test' | 'prod' | 'delete'>('');

  if (rol !== 'admin') {
    return (
      <div className="h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 grid place-items-center p-4">
          <div className="panel p-8 text-center max-w-md">
            <div className="text-4xl mb-3 opacity-50">🔒</div>
            <h2 className="text-sm font-bold text-txt mb-2">Acceso restringido</h2>
            <p className="text-xs text-txt-muted">Solo los administradores pueden gestionar respaldos del sistema.</p>
            <Link to="/dashboard" className="btn-outline mt-4 inline-block !py-1.5 !text-xs">← Volver</Link>
          </div>
        </main>
      </div>
    );
  }

  const lista = useQuery<BackupItem[]>({
    queryKey: ['backups'],
    queryFn: async () => (await api.get('/backups')).data,
    refetchInterval: 60_000,
  });

  const crear = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { tipo: 'completo' };
      if (useEncryption) {
        if (!password || password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
        body.password = password;
      }
      return (await api.post('/backups', body, { timeout: 300_000 })).data;
    },
    onSuccess: (b: BackupItem) => {
      setMsg({ tipo: 'ok', texto: `Backup generado (${fmtSize(b.size)})${b.encrypted ? ' [cifrado]' : ''}.` });
      setPassword('');
      qc.invalidateQueries({ queryKey: ['backups'] });
      setTimeout(() => setMsg(null), 5000);
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) =>
      setMsg({ tipo: 'err', texto: e.response?.data?.message ?? e.message ?? 'fallo generando backup' }),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/backups/${encodeURIComponent(id)}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  async function descargar(b: BackupItem) {
    const resp = await api.get(`/backups/${encodeURIComponent(b.id)}/download`, { responseType: 'blob' });
    const blob = new Blob([resp.data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = b.filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-4 grid gap-4 grid-cols-1 md:grid-cols-[380px_1fr]">
        {/* ---------------- Crear ---------------- */}
        <aside className="panel p-4 space-y-3 h-fit">
          <h2 className="text-sm font-bold tracking-wider">NUEVO RESPALDO</h2>
          <div className="text-xs text-txt-muted leading-relaxed">
            Tipo: <b className="text-txt">Completo</b><br/>
            Incluye base de datos (73 parques, alertas, reglas, usuarios, eventos) + reportes PDF/XLSX generados.<br/>
            Formato <code className="font-mono text-accent-green">.pnnc</code> — propio de Manobi.
          </div>

          <label className="flex items-center gap-2 pt-2 text-xs cursor-pointer select-none">
            <input type="checkbox" checked={useEncryption} onChange={(e) => setUseEncryption(e.target.checked)} className="h-4 w-4" />
            <span>Cifrar con contraseña (AES-256)</span>
          </label>

          {useEncryption && (
            <label className="block">
              <span className="text-xs font-mono text-txt-muted">CONTRASEÑA</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 8 caracteres"
                autoComplete="new-password"
                className="mt-1 w-full input-field !py-2 text-xs"
              />
              <div className="text-[10px] text-accent-amber mt-1">
                ⚠ Si pierdes esta contraseña, el backup NO podrá recuperarse. No se guarda en el servidor.
              </div>
            </label>
          )}

          <button
            onClick={() => crear.mutate()}
            disabled={crear.isPending}
            className="w-full bg-pnn-green text-white font-bold py-2.5 rounded hover:brightness-110 disabled:opacity-50 transition text-sm">
            {crear.isPending ? 'Generando… (puede tomar 30s–2min)' : 'GENERAR RESPALDO'}
          </button>

          {msg && (
            <div className={`text-xs px-3 py-2 rounded ${msg.tipo === 'ok' ? 'bg-pnn-green/10 text-pnn-green' : 'bg-accent-red/10 text-accent-red'}`}>
              {msg.texto}
            </div>
          )}

          <Link to="/dashboard" className="block text-xs text-txt-muted hover:text-pnn-blue pt-2">← Volver al dashboard</Link>
        </aside>

        {/* ---------------- Lista ---------------- */}
        <section className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider">RESPALDOS ALMACENADOS</h2>
            <span className="text-xs font-mono text-txt-muted">{lista.data?.length ?? 0} archivo{(lista.data?.length ?? 0) === 1 ? '' : 's'}</span>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-border-subtle">
            {lista.isLoading && <div className="p-6 text-center text-xs text-txt-light">Cargando…</div>}
            {!lista.isLoading && lista.data?.length === 0 && (
              <div className="p-6 text-center text-xs text-txt-light">
                <div className="text-3xl mb-2 opacity-40">💾</div>
                Sin respaldos aún. Genera el primero con el botón de la izquierda.
              </div>
            )}
            {lista.data?.map((b) => (
              <div key={b.id} className="px-4 py-3 hover:bg-bg-surface2/50">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-txt truncate" title={b.filename}>{b.filename}</div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-txt-muted">
                      <span className={`chip ${b.tipo === 'completo' ? 'chip-verde' : 'chip-amarillo'}`}>{b.tipo.toUpperCase()}</span>
                      {b.encrypted && <span className="chip chip-rojo">CIFRADO</span>}
                      <span>{fmtSize(b.size)}</span>
                      <span>·</span>
                      <span>{b.creado_en ? new Date(b.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '—'}</span>
                      {b.creado_por && <><span>·</span><span>por {b.creado_por}</span></>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => descargar(b)}
                      className="text-[11px] px-2 py-1 border border-pnn-blue text-pnn-blue rounded hover:bg-pnn-blue/10">
                      ↓ Descargar
                    </button>
                    <button onClick={() => { setSelected(b); setModalMode('verify'); }}
                      className="text-[11px] px-2 py-1 border border-border-subtle text-txt rounded hover:bg-bg-surface2">
                      Verificar
                    </button>
                    <button onClick={() => { setSelected(b); setModalMode('test'); }}
                      className="text-[11px] px-2 py-1 border border-accent-amber/60 text-accent-amber rounded hover:bg-accent-amber/10">
                      Restaurar (test)
                    </button>
                    <button onClick={() => { setSelected(b); setModalMode('prod'); }}
                      className="text-[11px] px-2 py-1 border border-accent-red/60 text-accent-red rounded hover:bg-accent-red/10">
                      Restaurar PROD
                    </button>
                    <button onClick={() => { if (confirm(`Eliminar "${b.filename}"?`)) eliminar.mutate(b.id); }}
                      className="text-[11px] px-2 py-1 border border-accent-red/40 text-accent-red rounded hover:bg-accent-red/10">
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ---------------- Modal ---------------- */}
      {selected && modalMode && (
        <BackupActionModal
          backup={selected}
          mode={modalMode}
          onClose={() => { setSelected(null); setModalMode(''); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Modal de acción (verify / restore-test / restore-prod)
// ============================================================================
function BackupActionModal({
  backup,
  mode,
  onClose,
}: {
  backup: BackupItem;
  mode: 'verify' | 'test' | 'prod' | 'delete';
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const titles = {
    verify: 'Verificar respaldo',
    test: 'Restaurar en DB temporal (safe)',
    prod: '⚠ RESTAURAR A PRODUCCIÓN',
    delete: 'Eliminar',
  };

  const descripciones = {
    verify: 'Valida la integridad del archivo y descifra el manifest. No modifica nada.',
    test: 'Crea una base de datos temporal, restaura el dump ahí y cuenta las filas principales. No toca producción.',
    prod: 'Esta acción SOBRESCRIBE la base de datos de producción con los datos del respaldo. Los usuarios conectados verán errores durante ~30–60 segundos. No es reversible.',
    delete: '',
  };

  const run = useMutation({
    mutationFn: async () => {
      setError(null);
      if (mode === 'verify') {
        return (await api.post(`/backups/${encodeURIComponent(backup.id)}/verify`,
          { password: backup.encrypted ? password : undefined })).data;
      }
      if (mode === 'test') {
        return (await api.post(`/backups/${encodeURIComponent(backup.id)}/restore-test`,
          { password: backup.encrypted ? password : undefined }, { timeout: 300_000 })).data;
      }
      if (mode === 'prod') {
        if (confirmText !== 'CONFIRMAR PRODUCCION') throw new Error('Escribe exactamente: CONFIRMAR PRODUCCION');
        return (await api.post(`/backups/${encodeURIComponent(backup.id)}/restore-prod`,
          { password: backup.encrypted ? password : undefined, confirm: confirmText },
          { timeout: 600_000 })).data;
      }
    },
    onSuccess: (d) => {
      setResult(d);
      if (mode === 'prod') qc.invalidateQueries();
    },
    onError: (e: Error & { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/70 grid place-items-center z-50 p-4">
      <div className={`panel max-w-lg w-full p-5 space-y-3 ${mode === 'prod' ? 'border-2 border-accent-red' : ''}`}>
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-bold text-txt">{titles[mode]}</h3>
          <button onClick={onClose} className="text-txt-light hover:text-txt text-lg leading-none">×</button>
        </div>
        <div className="text-xs text-txt-muted font-mono truncate" title={backup.filename}>{backup.filename}</div>
        <p className="text-xs text-txt leading-relaxed">{descripciones[mode]}</p>

        {backup.encrypted && (
          <label className="block">
            <span className="text-xs font-mono text-txt-muted">CONTRASEÑA DEL BACKUP</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full input-field !py-2 text-xs" autoComplete="off" />
          </label>
        )}

        {mode === 'prod' && (
          <>
            <div className="text-xs bg-accent-red/10 border border-accent-red/30 text-accent-red p-3 rounded leading-relaxed">
              <b>ACCIÓN DESTRUCTIVA.</b> La base de datos actual será reemplazada. Asegúrate de tener un respaldo del estado actual antes de continuar.
            </div>
            <label className="block">
              <span className="text-xs font-mono text-txt-muted">Escribe <b>CONFIRMAR PRODUCCION</b> para proceder:</span>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CONFIRMAR PRODUCCION"
                className="mt-1 w-full input-field !py-2 text-xs font-mono" autoComplete="off" />
            </label>
          </>
        )}

        {error && (
          <div className="text-xs bg-accent-red/10 text-accent-red p-2 rounded">
            {error}
          </div>
        )}

        {result !== null && (
          <details open className="text-xs bg-bg-surface2/60 p-3 rounded">
            <summary className="cursor-pointer font-mono text-pnn-green">Resultado</summary>
            <pre className="mt-2 overflow-auto max-h-60 text-[10px]">{JSON.stringify(result, null, 2)}</pre>
          </details>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-outline flex-1 !py-2 !text-xs">Cerrar</button>
          <button
            onClick={() => run.mutate()}
            disabled={run.isPending || (mode === 'prod' && confirmText !== 'CONFIRMAR PRODUCCION')}
            className={`flex-1 py-2 rounded text-xs font-bold disabled:opacity-40 ${
              mode === 'prod' ? 'bg-accent-red text-white hover:brightness-110' : 'bg-pnn-green text-white hover:brightness-110'
            }`}>
            {run.isPending ? 'Ejecutando…' : mode === 'prod' ? 'RESTAURAR PRODUCCIÓN' : 'Ejecutar'}
          </button>
        </div>
      </div>
    </div>
  );
}
