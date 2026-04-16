import {
  Injectable, UnauthorizedException, ForbiddenException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Usuario } from '../common/entities/usuario.entity';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario) private readonly users: Repository<Usuario>,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private lockKey(email: string) { return `auth:lock:${email.toLowerCase()}`; }
  private attemptsKey(email: string) { return `auth:att:${email.toLowerCase()}`; }
  private refreshKey(jti: string) { return `auth:refresh:${jti}`; }

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
    user.ultimo_login = new Date();
    await this.users.save(user);

    return this.issueTokens(user, meta);
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

  async logout(jti?: string) {
    if (jti) await this.redis.del(this.refreshKey(jti));
    return { ok: true };
  }
}
