import {
  Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { Usuario } from '../common/entities/usuario.entity';
import { REDIS_CLIENT } from '../redis/redis.module';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

// ---------------------------------------------------------------------------
// Configuración del flujo OTP por email (segundo factor)
// ---------------------------------------------------------------------------
const OTP_TTL_SECONDS = 5 * 60;      // Validez del código
const OTP_MAX_ATTEMPTS = 5;           // Intentos fallidos antes de invalidar challenge
const OTP_RESEND_COOLDOWN_SECONDS = 30;

interface OtpChallenge {
  userId: string;
  email: string;
  codeHash: string;
  attempts: number;
  lastSentAt: number; // epoch ms
  ip?: string;
  ua?: string;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario) private readonly users: Repository<Usuario>,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly notif: NotificacionesService,
  ) {}

  private lockKey(email: string) { return `auth:lock:${email.toLowerCase()}`; }
  private attemptsKey(email: string) { return `auth:att:${email.toLowerCase()}`; }
  private refreshKey(jti: string) { return `auth:refresh:${jti}`; }
  private otpKey(challengeId: string) { return `auth:otp:${challengeId}`; }

  private otpRequired(): boolean {
    return (this.cfg.get<string>('OTP_REQUIRED') ?? 'true') !== 'false';
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private maskEmail(email: string): string {
    const [u, d] = email.split('@');
    if (!u || !d) return email;
    const pre = u.slice(0, Math.min(2, u.length));
    return `${pre}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`;
  }

  // ---------------------------------------------------------------------------
  // Paso 1: valida credenciales y emite challenge OTP (o tokens si OTP está off)
  // ---------------------------------------------------------------------------
  async login(email: string, password: string, meta: { ip?: string; ua?: string }) {
    const locked = await this.redis.get(this.lockKey(email));
    if (locked) throw new ForbiddenException('Cuenta bloqueada temporalmente por intentos fallidos');

    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.email = :email', { email })
      .getOne();

    if (!user || !user.activo) {
      await this.registerFailure(email);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      await this.registerFailure(email);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.redis.del(this.attemptsKey(email));

    // Si OTP está deshabilitado globalmente (env OTP_REQUIRED=false), emitir tokens directo.
    if (!this.otpRequired()) {
      user.ultimo_login = new Date();
      await this.users.save(user);
      return this.issueTokens(user, meta);
    }

    // Emitir challenge OTP
    const challengeId = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge: OtpChallenge = {
      userId: user.id,
      email: user.email,
      codeHash: this.hashCode(code),
      attempts: 0,
      lastSentAt: Date.now(),
      ip: meta.ip,
      ua: meta.ua,
    };
    await this.redis.set(this.otpKey(challengeId), JSON.stringify(challenge), 'EX', OTP_TTL_SECONDS);
    await this.sendOtpEmail(user.email, user.nombre, code, meta);

    this.log.log(`OTP emitido para ${user.email} (challenge ${challengeId.slice(0, 8)}…)`);
    return {
      requires_otp: true,
      challenge_id: challengeId,
      email_masked: this.maskEmail(user.email),
      ttl_seconds: OTP_TTL_SECONDS,
    };
  }

  // ---------------------------------------------------------------------------
  // Paso 2: verifica el código OTP y emite los tokens de sesión
  // ---------------------------------------------------------------------------
  async verifyOtp(challengeId: string, code: string, meta: { ip?: string; ua?: string }) {
    const raw = await this.redis.get(this.otpKey(challengeId));
    if (!raw) throw new UnauthorizedException('El código expiró o no es válido. Vuelve a iniciar sesión.');

    const c = JSON.parse(raw) as OtpChallenge;
    if (c.attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(this.otpKey(challengeId));
      throw new ForbiddenException('Demasiados intentos. Vuelve a iniciar sesión.');
    }

    if (this.hashCode(code) !== c.codeHash) {
      c.attempts += 1;
      const ttl = await this.redis.ttl(this.otpKey(challengeId));
      await this.redis.set(this.otpKey(challengeId), JSON.stringify(c), 'EX', Math.max(ttl, 1));
      throw new UnauthorizedException(`Código incorrecto. Te quedan ${OTP_MAX_ATTEMPTS - c.attempts} intento(s).`);
    }

    // Código OK: consumir challenge y emitir tokens
    await this.redis.del(this.otpKey(challengeId));
    const user = await this.users.findOne({ where: { id: c.userId, activo: true } });
    if (!user) throw new UnauthorizedException('Usuario inactivo');
    user.ultimo_login = new Date();
    await this.users.save(user);
    this.log.log(`OTP verificado OK para ${user.email}`);
    return this.issueTokens(user, meta);
  }

  // ---------------------------------------------------------------------------
  // Reenvío del código OTP (mismo challenge, nuevo código)
  // ---------------------------------------------------------------------------
  async resendOtp(challengeId: string, meta: { ip?: string; ua?: string }) {
    const raw = await this.redis.get(this.otpKey(challengeId));
    if (!raw) throw new BadRequestException('El challenge expiró. Vuelve a iniciar sesión.');
    const c = JSON.parse(raw) as OtpChallenge;

    const since = (Date.now() - c.lastSentAt) / 1000;
    if (since < OTP_RESEND_COOLDOWN_SECONDS) {
      throw new BadRequestException(`Espera ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - since)}s antes de reenviar.`);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    c.codeHash = this.hashCode(code);
    c.lastSentAt = Date.now();
    c.attempts = 0;
    const ttl = await this.redis.ttl(this.otpKey(challengeId));
    await this.redis.set(this.otpKey(challengeId), JSON.stringify(c), 'EX', Math.max(ttl, 60));

    const user = await this.users.findOne({ where: { id: c.userId } });
    await this.sendOtpEmail(c.email, user?.nombre ?? '', code, meta);
    this.log.log(`OTP reenviado para ${c.email}`);
    return { ok: true };
  }

  private async sendOtpEmail(email: string, nombre: string, code: string, meta: { ip?: string; ua?: string }) {
    const pretty = `${code.slice(0, 3)} ${code.slice(3)}`;
    const ttlMin = Math.round(OTP_TTL_SECONDS / 60);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#f8faf6;border-radius:10px;color:#1f2937">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:13px;color:#5B8021;font-weight:600;letter-spacing:1px">MANOBI SENTINEL · PNN COLOMBIA</div>
        </div>
        <h2 style="margin:0 0 8px;color:#004880;font-size:18px">Código de verificación</h2>
        <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.5">
          Hola${nombre ? ' ' + nombre.split(' ')[0] : ''}, alguien intentó iniciar sesión en Manobi Sentinel con tu cuenta.
          Introduce este código para continuar:
        </p>
        <div style="background:#fff;border:2px solid #85B425;border-radius:8px;padding:18px;text-align:center;margin:16px 0">
          <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:#004880">${pretty}</div>
        </div>
        <p style="margin:12px 0;color:#6b7280;font-size:13px">
          El código expira en <b>${ttlMin} minutos</b>.
          Si no iniciaste sesión, ignora este correo y cambia tu contraseña.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4">
          Origen: ${meta.ip ?? '—'}<br>
          Navegador: ${(meta.ua ?? '—').slice(0, 120)}
        </p>
      </div>`;
    await this.notif.enviarEmail(email, `[Manobi Sentinel] Código ${pretty}`, html).catch((e: unknown) => {
      this.log.error(`No se pudo enviar OTP a ${email}: ${(e as Error).message}`);
    });
  }

  private async registerFailure(email: string) {
    const k = this.attemptsKey(email);
    const n = await this.redis.incr(k);
    if (n === 1) await this.redis.expire(k, 3600);
    const max = this.cfg.get<number>('login.maxAttempts')!;
    if (n >= max) {
      const mins = this.cfg.get<number>('login.lockMinutes')!;
      await this.redis.set(this.lockKey(email), '1', 'EX', mins * 60);
      this.log.warn(`Cuenta ${email} bloqueada ${mins}m tras ${n} intentos`);
    }
  }

  private async issueTokens(user: Usuario, meta: { ip?: string; ua?: string }) {
    const jti = randomUUID();
    const payload = { sub: user.id, email: user.email, rol: user.rol };
    const access_token = await this.jwt.signAsync(payload, {
      secret: this.cfg.get('jwt.accessSecret'),
      expiresIn: this.cfg.get('jwt.accessTtl'),
    });
    const refresh_token = await this.jwt.signAsync({ ...payload, jti }, {
      secret: this.cfg.get('jwt.refreshSecret'),
      expiresIn: this.cfg.get('jwt.refreshTtl'),
    });
    await this.redis.set(
      this.refreshKey(jti),
      JSON.stringify({ userId: user.id, ip: meta.ip, ua: meta.ua }),
      'EX', 7 * 24 * 3600,
    );
    return {
      access_token, refresh_token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    };
  }

  async refresh(token: string, meta: { ip?: string; ua?: string }) {
    let payload: { sub: string; email: string; rol: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.cfg.get('jwt.refreshSecret') });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
    const stored = await this.redis.get(this.refreshKey(payload.jti));
    if (!stored) throw new UnauthorizedException('Refresh token revocado');
    await this.redis.del(this.refreshKey(payload.jti));

    const user = await this.users.findOne({ where: { id: payload.sub, activo: true } });
    if (!user) throw new UnauthorizedException('Usuario inactivo');
    return this.issueTokens(user, meta);
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { ok: true };
    try {
      const p = await this.jwt.verifyAsync<{ jti?: string }>(refreshToken, {
        secret: this.cfg.get('jwt.refreshSecret'),
      });
      if (p.jti) await this.redis.del(this.refreshKey(p.jti));
    } catch {
      /* refresh token inválido o expirado — nada que revocar */
    }
    return { ok: true };
  }
}
