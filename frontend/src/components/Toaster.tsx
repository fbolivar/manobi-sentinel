import { useToastStore } from '../stores/toast.store';

const palette = {
  error:   'border-accent-red/60 text-accent-red bg-accent-red/10',
  success: 'border-accent-green/60 text-accent-green bg-accent-green/10',
  info:    'border-accent-blue/60 text-accent-blue bg-accent-blue/10',
} as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id}
          className={`pointer-events-auto min-w-[280px] max-w-sm border px-4 py-2.5 rounded shadow-lg font-mono text-xs ${palette[t.kind]}`}
          role="alert">
          <div className="flex items-start gap-3">
            <span className="flex-1 whitespace-pre-wrap break-words">{t.message}</span>
            <button onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100 transition"
              aria-label="Cerrar">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
