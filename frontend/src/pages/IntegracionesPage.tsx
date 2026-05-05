import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/layout/TopBar';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  destinatario: string;
}

interface ActiveConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  source: 'db' | 'env';
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface TestResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  host?: string;
  port?: number;
}

// ─── Definición de proveedores ─────────────────────────────────────────────────

type ProviderId = 'gmail' | 'workspace' | 'outlook' | 'o365';

interface StepItem {
  titulo: string;
  detalle: string;
  link?: { label: string; url: string };
  warning?: string;
}

interface Provider {
  id: ProviderId;
  label: string;
  subtitulo: string;
  color: string;
  logoChar: string;
  defaults: Omit<SmtpConfig, 'destinatario'>;
  pasos: StepItem[];
  envVars: (cfg: SmtpConfig) => string;
  notas: string[];
}

const PROVIDERS: Provider[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    subtitulo: 'Cuentas @gmail.com personales',
    color: '#EA4335',
    logoChar: 'G',
    defaults: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: '',
    },
    pasos: [
      {
        titulo: 'Activa la verificación en 2 pasos',
        detalle: 'Google exige 2FA para poder crear contraseñas de aplicación. Ve a Cuenta Google → Seguridad → Verificación en 2 pasos y completa el proceso.',
        link: { label: 'Abrir seguridad de Google', url: 'https://myaccount.google.com/security' },
      },
      {
        titulo: 'Crea una contraseña de aplicación',
        detalle: 'En Seguridad → Contraseñas de aplicación, selecciona "Otra (nombre personalizado)", escribe "Manobi Sentinel" y haz clic en Generar. Google mostrará una contraseña de 16 caracteres.',
        link: { label: 'Ir a contraseñas de aplicación', url: 'https://myaccount.google.com/apppasswords' },
        warning: 'Esta contraseña se muestra UNA SOLA VEZ. Cópiala ahora.',
      },
      {
        titulo: 'Configura los campos del formulario',
        detalle: 'Usuario SMTP: tu dirección @gmail.com completa. Contraseña SMTP: la contraseña de 16 caracteres generada en el paso anterior (NO tu contraseña de Gmail). Remitente: puede ser el mismo correo.',
      },
      {
        titulo: 'Ingresa un destinatario de prueba',
        detalle: 'Escribe cualquier correo al que tengas acceso para verificar que el email llega correctamente.',
      },
      {
        titulo: 'Haz clic en "Probar conexión"',
        detalle: 'El sistema intentará conectarse a smtp.gmail.com:587 y enviar un correo de prueba. Si la configuración es correcta verás el mensaje ✓ Conexión exitosa.',
      },
      {
        titulo: 'Aplica la configuración en el servidor',
        detalle: 'Copia las variables de entorno que se muestran abajo y edítalas en el archivo .env del servidor. Luego reinicia el contenedor API con: docker compose restart api',
      },
    ],
    envVars: (cfg) => `SMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_FROM=${cfg.from || cfg.user}\nSMTP_USER=${cfg.user}\nSMTP_PASS=${cfg.pass}`,
    notas: [
      'Gmail permite hasta 500 emails/día en cuentas gratuitas.',
      'Las contraseñas de aplicación solo funcionan con 2FA activado.',
      'Si ves "Username and Password not accepted", verifica que estés usando la contraseña de aplicación, NO la de Gmail.',
    ],
  },
  {
    id: 'workspace',
    label: 'Google Workspace',
    subtitulo: 'Cuentas corporativas @tudominio.com',
    color: '#4285F4',
    logoChar: 'W',
    defaults: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: '',
    },
    pasos: [
      {
        titulo: 'Accede a la Admin Console de Google Workspace',
        detalle: 'Inicia sesión con una cuenta de Administrador en admin.google.com.',
        link: { label: 'Abrir Admin Console', url: 'https://admin.google.com' },
      },
      {
        titulo: 'Habilita SMTP externo para usuarios',
        detalle: 'Ve a Apps → Google Workspace → Gmail → Configuración de usuario final. Habilita "Acceso de aplicaciones menos seguras" O configura el "Relay de SMTP" para la IP del servidor Manobi.',
      },
      {
        titulo: 'Crea una cuenta de servicio para notificaciones',
        detalle: 'Recomendado: crea un buzón dedicado como notificaciones@tudominio.com exclusivamente para Manobi Sentinel. Activa verificación en 2 pasos para esa cuenta.',
      },
      {
        titulo: 'Genera contraseña de aplicación para la cuenta de servicio',
        detalle: 'Inicia sesión con la cuenta de servicio en myaccount.google.com → Seguridad → Contraseñas de aplicación → crea una para "Manobi Sentinel".',
        link: { label: 'Contraseñas de aplicación', url: 'https://myaccount.google.com/apppasswords' },
        warning: 'Usa la cuenta de servicio, no la de administrador, para generar esta contraseña.',
      },
      {
        titulo: 'Configura el formulario y prueba',
        detalle: 'Usa smtp.gmail.com:587 con las credenciales de la cuenta de servicio. El servidor SMTP de Google Workspace es idéntico al de Gmail.',
      },
      {
        titulo: 'Aplica en el servidor',
        detalle: 'Copia las variables de entorno mostradas abajo al archivo .env del servidor y reinicia el contenedor: docker compose restart api',
      },
    ],
    envVars: (cfg) => `SMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_FROM=${cfg.from || cfg.user}\nSMTP_USER=${cfg.user}\nSMTP_PASS=${cfg.pass}`,
    notas: [
      'Google Workspace Business permite envíos ilimitados desde dominios verificados.',
      'Usa el Relay de SMTP en Admin Console si prefieres autenticar por IP en vez de usuario/contraseña.',
      'Asegúrate de que el dominio esté verificado en Google Workspace para evitar filtros de spam.',
    ],
  },
  {
    id: 'outlook',
    label: 'Outlook / Hotmail',
    subtitulo: 'Cuentas @outlook.com y @hotmail.com',
    color: '#0078D4',
    logoChar: 'O',
    defaults: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: '',
    },
    pasos: [
      {
        titulo: 'Verifica tu cuenta Microsoft',
        detalle: 'Inicia sesión en account.microsoft.com. Asegúrate de tener acceso completo a la cuenta que usarás para enviar correos.',
        link: { label: 'Abrir cuenta Microsoft', url: 'https://account.microsoft.com' },
      },
      {
        titulo: 'Revisa si tienes autenticación de 2 factores',
        detalle: 'Ve a Seguridad → Más opciones de seguridad. Si tienes 2FA activo, necesitas crear una "contraseña de aplicación". Si no tienes 2FA, puedes usar tu contraseña normal.',
        link: { label: 'Seguridad de la cuenta', url: 'https://account.microsoft.com/security' },
      },
      {
        titulo: 'Crea una contraseña de aplicación (si aplica)',
        detalle: 'En Más opciones de seguridad → Contraseñas de aplicación → Crear. Dale un nombre como "Manobi Sentinel" y copia la contraseña generada.',
        warning: 'Si no tienes 2FA, usa tu contraseña normal de Outlook/Hotmail.',
      },
      {
        titulo: 'Configura los campos del formulario',
        detalle: 'Host: smtp-mail.outlook.com, Puerto: 587. Usuario SMTP: tu dirección @outlook.com o @hotmail.com. Contraseña: la contraseña de aplicación (o normal si no tienes 2FA).',
      },
      {
        titulo: 'Prueba la conexión',
        detalle: 'Ingresa un correo destinatario y haz clic en "Probar conexión". Revisa tu bandeja de entrada del destinatario para confirmar que el email llegó.',
      },
      {
        titulo: 'Aplica en el servidor',
        detalle: 'Copia las variables de entorno y edítalas en el .env del servidor. Reinicia con: docker compose restart api',
      },
    ],
    envVars: (cfg) => `SMTP_HOST=smtp-mail.outlook.com\nSMTP_PORT=587\nSMTP_FROM=${cfg.from || cfg.user}\nSMTP_USER=${cfg.user}\nSMTP_PASS=${cfg.pass}`,
    notas: [
      'Outlook.com permite hasta 300 emails/día en cuentas gratuitas.',
      'Microsoft puede bloquear el acceso SMTP si detecta actividad inusual. Si hay error de autenticación, verifica en account.microsoft.com → Actividad.',
      'Para cuentas Hotmail antiguas sin 2FA: habilita "Acceso de aplicaciones menos seguras" en la configuración de seguridad.',
    ],
  },
  {
    id: 'o365',
    label: 'Office 365',
    subtitulo: 'Microsoft 365 empresarial',
    color: '#D83B01',
    logoChar: '365',
    defaults: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: '',
    },
    pasos: [
      {
        titulo: 'Accede al Centro de Administración de Microsoft 365',
        detalle: 'Inicia sesión como administrador global en admin.microsoft.com.',
        link: { label: 'Abrir Admin Center', url: 'https://admin.microsoft.com' },
      },
      {
        titulo: 'Crea o designa un buzón de envío dedicado',
        detalle: 'Recomendado: crea un buzón como alertas-manobi@tudominio.com en Usuarios → Usuarios activos → Agregar usuario. Asigna una licencia de Exchange Online.',
      },
      {
        titulo: 'Habilita SMTP AUTH para la cuenta',
        detalle: 'Ir a Exchange Admin Center (admin.exchange.microsoft.com) → Destinatarios → Buzones → selecciona el buzón → Administrar configuración de correo → Flujo de correo → Habilita "SMTP autenticado".',
        link: { label: 'Exchange Admin Center', url: 'https://admin.exchange.microsoft.com' },
        warning: 'Por defecto, Microsoft 365 deshabilita SMTP AUTH para todos los usuarios. DEBE habilitarse explícitamente.',
      },
      {
        titulo: 'Verifica la política de autenticación moderna',
        detalle: 'En Microsoft 365 Admin Center → Configuración → Org Settings → Modern Authentication. Asegúrate de que la autenticación básica esté permitida para SMTP (o usa autenticación OAuth2 con las herramientas avanzadas de Microsoft).',
      },
      {
        titulo: 'Configura el formulario',
        detalle: 'Host: smtp.office365.com, Puerto: 587. Usuario: el email del buzón de envío. Contraseña: la contraseña de la cuenta Microsoft 365. Si hay 2FA, crea una contraseña de aplicación.',
      },
      {
        titulo: 'Prueba y aplica en el servidor',
        detalle: 'Haz clic en "Probar conexión". Si es exitoso, copia las variables de entorno y aplícalas en el .env del servidor. Reinicia: docker compose restart api',
      },
    ],
    envVars: (cfg) => `SMTP_HOST=smtp.office365.com\nSMTP_PORT=587\nSMTP_FROM=${cfg.from || cfg.user}\nSMTP_USER=${cfg.user}\nSMTP_PASS=${cfg.pass}`,
    notas: [
      'Office 365 no tiene límite de envío por día para buzones empresariales (sujeto a políticas del tenant).',
      'Si ves error 535 "Authentication unsuccessful", SMTP AUTH no está habilitado para esa cuenta.',
      'Microsoft recomienda usar conectores de envío para escenarios de aplicaciones de mayor volumen.',
      'Para ambientes con Conditional Access muy restrictivo, considera usar la opción "Direct Send" de Exchange Online.',
    ],
  },
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'manobi_smtp_configs';

function loadConfig(id: ProviderId): Partial<SmtpConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return (JSON.parse(raw) as Record<string, Partial<SmtpConfig>>)[id] ?? {};
  } catch {
    return {};
  }
}

function saveConfig(id: ProviderId, cfg: Partial<SmtpConfig>) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Partial<SmtpConfig>>) : {};
    all[id] = { ...all[id], ...cfg };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* noop */ }
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function ProviderTab({ p, active, isServerActive, onClick }: { p: Provider; active: boolean; isServerActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border transition text-left ${
        active
          ? 'bg-bg-surface2 border-border-subtle text-txt shadow-sm'
          : 'border-transparent text-txt-muted hover:bg-bg-surface2/50 hover:text-txt'
      }`}
    >
      <span
        className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
        style={{ background: `${p.color}22`, color: p.color }}
      >
        {p.logoChar}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight flex items-center gap-1.5">
          {p.label}
          {isServerActive && (
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-pnn-green/15 text-pnn-green-dark border border-pnn-green/20">ACTIVO</span>
          )}
        </div>
        <div className="text-[10px] text-txt-muted leading-tight mt-0.5 hidden md:block">{p.subtitulo}</div>
      </div>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-pnn-blue shrink-0" />}
    </button>
  );
}

function StepCard({ step, num }: { step: StepItem; num: number }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 h-7 w-7 rounded-full bg-pnn-blue/10 border border-pnn-blue/20 flex items-center justify-center text-xs font-bold text-pnn-blue mt-0.5">
        {num}
      </div>
      <div className="min-w-0 pb-4 border-b border-border-subtle/40 last:border-0">
        <div className="text-sm font-semibold text-txt">{step.titulo}</div>
        <div className="text-xs text-txt-muted mt-1 leading-relaxed">{step.detalle}</div>
        {step.warning && (
          <div className="mt-2 text-xs px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
            ⚠ {step.warning}
          </div>
        )}
        {step.link && (
          <a
            href={step.link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-pnn-blue hover:underline"
          >
            {step.link.label} ↗
          </a>
        )}
      </div>
    </div>
  );
}

function ConfigForm({
  provider,
  activeServerConfig,
  onResult,
  onSaved,
}: {
  provider: Provider;
  activeServerConfig: ActiveConfig | null;
  onResult: (r: TestResult) => void;
  onSaved: () => void;
}) {
  const isThisProviderActive = activeServerConfig?.host === provider.defaults.host;

  const saved = loadConfig(provider.id);
  const [cfg, setCfg] = useState<SmtpConfig>(() => ({
    ...provider.defaults,
    destinatario: '',
    // Si este proveedor es el activo en servidor, pre-carga sus valores
    ...(isThisProviderActive
      ? { host: activeServerConfig!.host, port: activeServerConfig!.port, secure: activeServerConfig!.secure, user: activeServerConfig!.user, from: activeServerConfig!.from }
      : {}),
    ...saved,
  }));
  const [showPass, setShowPass] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const set = (k: keyof SmtpConfig, v: string | number | boolean) => {
    setCfg((prev) => {
      const next = { ...prev, [k]: v };
      saveConfig(provider.id, next);
      return next;
    });
  };

  const test = useMutation<TestResult, unknown, void>({
    mutationFn: async () => (await api.post('/email/test-custom', cfg)).data as TestResult,
    onSuccess: (r) => onResult(r),
    onError: () => onResult({ ok: false, error: 'Error de red o el servidor no respondió' }),
  });

  const save = useMutation<{ ok: boolean; message: string }, { response?: { data?: { message?: string } } }, void>({
    mutationFn: async () => (await api.put('/email/config', {
      host: cfg.host, port: cfg.port, secure: cfg.secure,
      user: cfg.user, pass: cfg.pass, from: cfg.from,
    })).data,
    onSuccess: (r) => {
      setSaveMsg({ text: r.message, ok: true });
      onSaved();
      setTimeout(() => setSaveMsg(null), 5000);
    },
    onError: (e) => {
      setSaveMsg({ text: `Error: ${e.response?.data?.message ?? 'No se pudo guardar'}`, ok: false });
      setTimeout(() => setSaveMsg(null), 5000);
    },
  });

  const inputCls = 'mt-1 w-full input-field !py-1.5 !text-xs';

  return (
    <div className="space-y-4">

      {/* Indicador de configuración activa */}
      {isThisProviderActive && activeServerConfig?.source === 'db' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pnn-green/10 border border-pnn-green/20 text-xs text-pnn-green-dark">
          <span className="w-2 h-2 rounded-full bg-pnn-green animate-pulse" />
          Esta es la configuración activa del servidor — guardada en base de datos
        </div>
      )}

      {/* Grid de campos SMTP */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block col-span-2 md:col-span-1">
          <span className="text-xs font-mono text-txt-muted">SERVIDOR SMTP</span>
          <input type="text" value={cfg.host} onChange={(e) => set('host', e.target.value)}
            className={inputCls} placeholder="smtp.ejemplo.com" />
        </label>
        <label className="block">
          <span className="text-xs font-mono text-txt-muted">PUERTO</span>
          <input type="number" value={cfg.port} onChange={(e) => set('port', Number(e.target.value))}
            className={inputCls} placeholder="587" />
        </label>
        <label className="flex items-end gap-2 pb-1">
          <input type="checkbox" id={`secure-${provider.id}`} checked={cfg.secure}
            onChange={(e) => set('secure', e.target.checked)} className="h-4 w-4 accent-pnn-green" />
          <span className="text-xs font-mono text-txt-muted">SSL/TLS (puerto 465)</span>
        </label>
        <label className="block col-span-2">
          <span className="text-xs font-mono text-txt-muted">USUARIO SMTP (correo completo)</span>
          <input type="email" value={cfg.user} onChange={(e) => set('user', e.target.value)}
            className={inputCls} placeholder="notificaciones@tudominio.com" autoComplete="username" />
        </label>
        <label className="block col-span-2">
          <span className="text-xs font-mono text-txt-muted">CONTRASEÑA SMTP</span>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={cfg.pass}
              onChange={(e) => set('pass', e.target.value)}
              className={`${inputCls} pr-16`} placeholder="Contraseña de aplicación"
              autoComplete="current-password" />
            <button type="button" onClick={() => setShowPass((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-txt-muted hover:text-txt font-mono">
              {showPass ? 'OCULTAR' : 'MOSTRAR'}
            </button>
          </div>
        </label>
        <label className="block col-span-2">
          <span className="text-xs font-mono text-txt-muted">DIRECCIÓN REMITENTE</span>
          <input type="email" value={cfg.from} onChange={(e) => set('from', e.target.value)}
            className={inputCls} placeholder="Manobi Sentinel <alertas@tudominio.com>" />
        </label>
        <label className="block col-span-2 border-t border-border-subtle pt-3">
          <span className="text-xs font-mono text-txt-muted">CORREO DE PRUEBA (destinatario)</span>
          <input type="email" value={cfg.destinatario} onChange={(e) => set('destinatario', e.target.value)}
            className={inputCls} placeholder="tu@correo.com" />
        </label>
      </div>

      {/* Botones Probar + Guardar */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => test.mutate()}
          disabled={test.isPending || !cfg.host || !cfg.user || !cfg.pass || !cfg.destinatario}
          className="flex-1 py-2.5 rounded-lg font-bold text-sm transition disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: `${provider.color}18`, color: provider.color, border: `1px solid ${provider.color}44` }}
        >
          {test.isPending ? (
            <><span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />Probando…</>
          ) : 'Probar conexión'}
        </button>

        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !cfg.host || !cfg.user || !cfg.pass}
          title="Guarda esta configuración como la activa para el envío de alertas"
          className="flex-1 py-2.5 rounded-lg font-bold text-sm transition disabled:opacity-40 flex items-center justify-center gap-2 bg-pnn-green/10 text-pnn-green-dark border border-pnn-green/30 hover:bg-pnn-green/20"
        >
          {save.isPending ? (
            <><span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />Guardando…</>
          ) : '✓ Guardar como activa'}
        </button>
      </div>

      {/* Resultado del guardado */}
      {saveMsg && (
        <div className={`text-xs px-3 py-2 rounded border ${
          saveMsg.ok
            ? 'border-pnn-green/30 bg-pnn-green/10 text-pnn-green-dark'
            : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
        }`}>
          {saveMsg.text}
        </div>
      )}

      {/* Variables de entorno (alternativa) */}
      <details className="group">
        <summary className="text-[10px] font-mono text-txt-muted cursor-pointer hover:text-txt list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          Ver variables de entorno (alternativa manual)
        </summary>
        <div className="mt-2 border border-border-subtle rounded-lg overflow-hidden">
          <pre className="p-3 text-[11px] font-mono text-pnn-green bg-bg overflow-x-auto">{provider.envVars(cfg)}</pre>
          <div className="px-3 py-2 bg-bg-surface/30 text-[10px] text-txt-muted border-t border-border-subtle">
            Si prefieres configurar manualmente: edita el .env y ejecuta{' '}
            <code className="text-pnn-blue">docker compose restart api</code>
          </div>
        </div>
      </details>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function detectProvider(host: string): ProviderId {
  if (host.includes('gmail') || host.includes('google')) return 'gmail';
  if (host.includes('outlook')) return 'outlook';
  if (host.includes('office365')) return 'o365';
  return 'gmail';
}

export function IntegracionesPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<ProviderId>('gmail');
  const [result, setResult] = useState<TestResult | null>(null);

  const provider = PROVIDERS.find((p) => p.id === activeId)!;

  const activeConfig = useQuery<ActiveConfig>({
    queryKey: ['email-config'],
    queryFn: async () => (await api.get('/email/config')).data as ActiveConfig,
    staleTime: 30_000,
  });

  const stats = useQuery<QueueStats>({
    queryKey: ['email-queue-stats'],
    queryFn: async () => (await api.get('/email/queue/stats')).data as QueueStats,
    refetchInterval: 30_000,
  });

  const serverActiveProviderId = activeConfig.data?.host
    ? detectProvider(activeConfig.data.host)
    : null;

  function handleResult(r: TestResult) {
    setResult(r);
    setTimeout(() => setResult(null), 12_000);
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['email-config'] });
  }

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4 space-y-4">

        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-bold tracking-wider">INTEGRACIONES DE CORREO</h1>
            <p className="text-xs text-txt-muted mt-0.5">Configura y prueba la integración SMTP con tu proveedor de correo para alertas y notificaciones.</p>
          </div>
          <Link to="/dashboard" className="text-xs text-txt-muted hover:text-pnn-blue shrink-0">← Dashboard</Link>
        </div>

        {/* Estado de la cola */}
        {stats.data && (
          <div className="panel px-4 py-3 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-mono text-txt-muted">COLA DE EMAIL:</span>
            {([
              { k: 'waiting', label: 'En espera', color: 'text-pnn-blue' },
              { k: 'active', label: 'Enviando', color: 'text-amber-400' },
              { k: 'completed', label: 'Enviados', color: 'text-pnn-green-dark' },
              { k: 'failed', label: 'Fallidos', color: 'text-accent-red' },
            ] as const).map(({ k, label, color }) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`font-mono text-sm font-bold ${color}`}>{stats.data[k]}</span>
                <span className="text-xs text-txt-muted">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Resultado del test */}
        {result && (
          <div className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2 ${
            result.ok
              ? 'bg-pnn-green/10 border-pnn-green/30 text-pnn-green-dark'
              : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
          }`}>
            <span className="text-lg">{result.ok ? '✓' : '✗'}</span>
            {result.ok
              ? `Conexión exitosa con ${result.host}:${result.port}. Correo de prueba enviado (ID: ${result.messageId?.slice(-12)})`
              : `Error: ${result.error}`}
          </div>
        )}

        {/* Selector de proveedores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PROVIDERS.map((p) => (
            <ProviderTab
              key={p.id}
              p={p}
              active={p.id === activeId}
              isServerActive={serverActiveProviderId === p.id && !!activeConfig.data?.user}
              onClick={() => { setActiveId(p.id); setResult(null); }}
            />
          ))}
        </div>

        {/* Contenido del proveedor activo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Guía paso a paso */}
          <section className="panel p-4 space-y-1">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{ background: `${provider.color}22`, color: provider.color }}
              >
                {provider.logoChar}
              </span>
              <div>
                <h2 className="text-sm font-bold">{provider.label}</h2>
                <p className="text-[10px] text-txt-muted">{provider.subtitulo}</p>
              </div>
            </div>

            <div className="space-y-0">
              {provider.pasos.map((paso, i) => (
                <StepCard key={i} step={paso} num={i + 1} />
              ))}
            </div>

            {/* Notas del proveedor */}
            <div className="mt-4 pt-3 border-t border-border-subtle space-y-1.5">
              <div className="text-[10px] font-mono text-txt-muted mb-2">NOTAS IMPORTANTES</div>
              {provider.notas.map((nota, i) => (
                <div key={i} className="flex gap-2 text-xs text-txt-muted">
                  <span className="text-pnn-blue shrink-0">•</span>
                  <span>{nota}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Formulario de configuración y prueba */}
          <section className="panel p-4">
            <h2 className="text-sm font-bold mb-4">CONFIGURAR Y PROBAR</h2>
            <ConfigForm
              key={activeId}
              provider={provider}
              activeServerConfig={activeConfig.data ?? null}
              onResult={handleResult}
              onSaved={handleSaved}
            />
          </section>
        </div>

        {/* Referencia rápida de todos los proveedores */}
        <section className="panel p-4">
          <h2 className="text-sm font-bold mb-3">REFERENCIA RÁPIDA — CONFIGURACIÓN SMTP</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="pb-2 text-left font-mono text-txt-muted">PROVEEDOR</th>
                  <th className="pb-2 text-left font-mono text-txt-muted">SERVIDOR</th>
                  <th className="pb-2 text-left font-mono text-txt-muted">PUERTO</th>
                  <th className="pb-2 text-left font-mono text-txt-muted">CIFRADO</th>
                  <th className="pb-2 text-left font-mono text-txt-muted">AUTENTICACIÓN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/40">
                {[
                  { nombre: 'Gmail', host: 'smtp.gmail.com', port: '587', enc: 'STARTTLS', auth: 'Contraseña de aplicación (requiere 2FA)', color: '#EA4335' },
                  { nombre: 'Google Workspace', host: 'smtp.gmail.com', port: '587', enc: 'STARTTLS', auth: 'Contraseña de aplicación (cuenta de servicio)', color: '#4285F4' },
                  { nombre: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: '587', enc: 'STARTTLS', auth: 'Contraseña (o de aplicación si hay 2FA)', color: '#0078D4' },
                  { nombre: 'Office 365', host: 'smtp.office365.com', port: '587', enc: 'STARTTLS', auth: 'Usuario + contraseña (SMTP AUTH habilitado)', color: '#D83B01' },
                ].map((row) => (
                  <tr key={row.nombre} className="hover:bg-bg-surface2/30">
                    <td className="py-2.5 pr-4">
                      <span className="font-semibold text-txt">{row.nombre}</span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-pnn-blue">{row.host}</td>
                    <td className="py-2.5 pr-4 font-mono text-txt">{row.port}</td>
                    <td className="py-2.5 pr-4">
                      <span className="chip chip-verde">{row.enc}</span>
                    </td>
                    <td className="py-2.5 text-txt-muted">{row.auth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}
