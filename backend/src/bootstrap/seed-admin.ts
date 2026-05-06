import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../common/entities/usuario.entity';

@Injectable()
export class SeedAdminService implements OnApplicationBootstrap {
  private readonly log = new Logger('Seed');
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = process.env.ADMIN_EMAIL ?? 'admin@manobi.local';
    const exists = await this.repo.findOne({ where: { email } });
    if (exists) return;
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      const { randomBytes } = await import('crypto');
      password = randomBytes(18).toString('base64url').slice(0, 20) + 'A1!';
      this.log.warn('╔══════════════════════════════════════════════════════╗');
      this.log.warn('║  ADMIN_PASSWORD no configurado — contraseña generada ║');
      this.log.warn(`║  → ${password.padEnd(48)}║`);
      this.log.warn('║  Cópiala ahora. No se mostrará de nuevo.             ║');
      this.log.warn('╚══════════════════════════════════════════════════════╝');
    }
    const rounds = this.cfg.get<number>('bcryptRounds') ?? 12;
    await this.repo.save({
      nombre: 'Administrador',
      email,
      password_hash: await bcrypt.hash(password, rounds),
      rol: 'admin',
      activo: true,
    });
    this.log.warn(`Usuario admin inicial creado: ${email} (cambiar contraseña tras primer login)`);
  }
}
