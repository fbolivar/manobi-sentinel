import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import type { LoginResponse } from '../types';

type Step = 'credentials' | 'otp';

interface OtpChallenge {
  challenge_id: string;
  email_masked: string;
  ttl_seconds: number;
}

interface LoginResponseOtp extends Partial<LoginResponse> {
  requires_otp?: boolean;
  challenge_id?: string;
  email_masked?: string;
  ttl_seconds?: number;
}

export function LoginPage() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const setTokens = useAuthStore((s) => s.setTokens);
  const navigate = useNavigate();
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  // Cooldown del botón reenviar
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Focus en el input de código al cambiar de paso
  useEffect(() => {
    if (step === 'otp') codeInputRef.current?.focus();
  }, [step]);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      const { data } = await api.post<LoginResponseOtp>('/auth/login', { email, password });
      if (data.requires_otp && data.challenge_id) {
        setChallenge({
          challenge_id: data.challenge_id,
          email_masked: data.email_masked ?? email,
          ttl_seconds: data.ttl_seconds ?? 300,
        });
        setStep('otp');
        setResendCooldown(30);
        setInfo(`Enviamos un código de 6 dígitos a ${data.email_masked ?? 'tu correo'}. Llega en 10–30 segundos.`);
      } else if (data.access_token && data.refresh_token && data.user) {
        // OTP deshabilitado en backend: login directo
        setTokens(data.access_token, data.refresh_token, data.user);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Error de autenticación');
    } finally { setLoading(false); }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setError(null); setInfo(null); setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/verify-otp', {
        challenge_id: challenge.challenge_id,
        code: code.trim(),
      });
      setTokens(data.access_token, data.refresh_token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Código inválido');
      setCode('');
      codeInputRef.current?.focus();
    } finally { setLoading(false); }
  }

  async function resendCode() {
    if (!challenge || resendCooldown > 0) return;
    setError(null); setInfo(null); setLoading(true);
    try {
      await api.post('/auth/resend-otp', { challenge_id: challenge.challenge_id });
      setInfo('Nuevo código enviado. Revisa tu correo.');
      setResendCooldown(30);
      setCode('');
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'No se pudo reenviar el código');
    } finally { setLoading(false); }
  }

  function backToCredentials() {
    setStep('credentials');
    setChallenge(null);
    setCode('');
    setError(null);
    setInfo(null);
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 bg-gradient-to-br from-white via-white to-pnn-green/5 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-pnn-green/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-pnn-blue/10 blur-3xl" aria-hidden />

      <main className="relative w-full max-w-md">
        <header className="flex flex-col items-center text-center mb-6">
          <img src="/logo.png" alt="" className="h-14 w-14 rounded-2xl object-cover shadow-md ring-1 ring-black/5 mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-txt">Manobi Sentinel</h1>
          <p className="text-xs text-txt-muted mt-1">Sistema de Alerta Temprana · PNN Colombia</p>
        </header>

        {step === 'credentials' && (
          <form onSubmit={submitCredentials}
            className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-7 sm:p-8 space-y-5">
            <h2 className="text-lg font-semibold text-txt">Iniciar sesión</h2>

            <label className="block">
              <span className="text-[11px] font-medium text-txt-muted uppercase tracking-wider">Email institucional</span>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@parquesnacionales.gov.co"
                className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-txt
                           placeholder:text-gray-400
                           focus:border-pnn-green focus:ring-2 focus:ring-pnn-green/20 focus:outline-none
                           transition" />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium text-txt-muted uppercase tracking-wider">Contraseña</span>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-txt
                           placeholder:text-gray-400
                           focus:border-pnn-green focus:ring-2 focus:ring-pnn-green/20 focus:outline-none
                           transition" />
            </label>

            {error && <ErrorBox text={error} />}

            <button type="submit" disabled={loading}
              className="group w-full bg-pnn-green text-white font-semibold text-sm py-2.5 rounded-lg
                         hover:brightness-110 active:brightness-95
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 transition">
              {loading ? 'Verificando…' : <>Continuar <Arrow /></>}
            </button>

            <div className="text-center text-[11px] text-txt-light pt-1">
              Después de este paso te enviaremos un código de 6 dígitos a tu correo.
            </div>
          </form>
        )}

        {step === 'otp' && challenge && (
          <form onSubmit={submitOtp}
            className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-7 sm:p-8 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-txt">Verificación en dos pasos</h2>
              <p className="text-sm text-txt-muted mt-1 leading-snug">
                Enviamos un código a <b className="text-txt">{challenge.email_masked}</b>. Expira en {Math.round(challenge.ttl_seconds / 60)} min.
              </p>
            </div>

            <label className="block">
              <span className="text-[11px] font-medium text-txt-muted uppercase tracking-wider">Código de 6 dígitos</span>
              <input
                ref={codeInputRef}
                type="text" required
                inputMode="numeric" autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="mt-1.5 w-full px-3.5 py-3 rounded-lg border border-gray-200 bg-white
                           text-center text-2xl font-mono font-bold tracking-[0.5em] text-txt
                           placeholder:text-gray-300
                           focus:border-pnn-green focus:ring-2 focus:ring-pnn-green/20 focus:outline-none
                           transition" />
            </label>

            {info && <InfoBox text={info} />}
            {error && <ErrorBox text={error} />}

            <button type="submit" disabled={loading || code.length !== 6}
              className="group w-full bg-pnn-green text-white font-semibold text-sm py-2.5 rounded-lg
                         hover:brightness-110 active:brightness-95
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 transition">
              {loading ? 'Verificando…' : <>Ingresar <Arrow /></>}
            </button>

            <div className="flex items-center justify-between text-[11px]">
              <button type="button" onClick={backToCredentials}
                className="text-txt-muted hover:text-txt transition">← Cambiar cuenta</button>
              <button type="button" onClick={resendCode}
                disabled={resendCooldown > 0 || loading}
                className="text-pnn-blue hover:underline disabled:opacity-50 disabled:no-underline">
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </form>
        )}

        <footer className="mt-6 text-center space-y-1">
          <p className="text-[11px] text-txt-muted">
            Parques Nacionales Naturales de Colombia
            <span className="mx-1.5 text-gray-300">·</span>
            Ministerio de Ambiente y Desarrollo Sostenible
          </p>
          <p className="text-[10px] text-txt-light flex items-center justify-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Acceso restringido · Sistema gubernamental monitoreado
          </p>
        </footer>
      </main>
    </div>
  );
}

// --- componentes auxiliares ---

function Arrow() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="transition-transform group-hover:translate-x-0.5" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div role="alert"
      className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
      <span aria-hidden>⚠</span>
      <span className="leading-snug">{text}</span>
    </div>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2">
      <span aria-hidden>✉</span>
      <span className="leading-snug">{text}</span>
    </div>
  );
}
