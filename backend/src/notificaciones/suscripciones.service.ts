import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isIP } from 'node:net';
import { SuscripcionNotificacion } from '../common/entities/suscripcion.entity';

export interface SuscripcionDTO {
  parque_id?: string | null;
  niveles: ('verde' | 'amarillo' | 'rojo')[];
  canal: 'email' | 'webhook' | 'push';
  destino?: string;
  activa?: boolean;
}

/**
 * Bloquea URLs hacia IPs privadas / internas (defensa contra SSRF en webhooks).
 * El servidor NO debe poder ser inducido a hacer peticiones hacia sus propias
 * redes internas (Redis, Postgres, MinIO, metadata endpoints de nubes, etc).
 */
function assertSafeWebhookUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new BadRequestException('La URL del webhook no es válida'); }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(`Protocolo ${parsed.protocol} no permitido (solo http/https)`);
  }
  const host = parsed.hostname.toLowerCase();

  // Hostnames sensibles evidentes
  const blocked = ['localhost', '0.0.0.0', '::', 'ip6-localhost', 'ip6-loopback'];
  if (blocked.includes(host)) {
    throw new BadRequestException(`Host ${host} no permitido`);
  }
  // Nombres de servicios internos de la stack Docker
  const internal = ['api', 'postgres', 'redis', 'minio', 'grafana', 'prometheus', 'loki', 'ai-service', 'postfix', 'nginx'];
  if (internal.includes(host)) {
    throw new BadRequestException(`Host ${host} apunta a un servicio interno`);
  }

  // Si es una IP literal, bloquear rangos privados y link-local.
  const ipFamily = isIP(host);
  if (ipFamily === 4) {
    const p = host.split('.').map(Number);
    const [a, b] = p;
    const isPrivateV4 =
      a === 10 ||                              // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12
      (a === 192 && b === 168) ||              // 192.168.0.0/16
      a === 127 ||                             // loopback
      (a === 169 && b === 254) ||              // link-local / metadata
      a === 0 ||                               // 0.0.0.0/8
      a >= 224;                                // multicast + reservados
    if (isPrivateV4) throw new BadRequestException(`IP ${host} es privada/interna, no permitida para webhooks`);
  } else if (ipFamily === 6) {
    // Bloqueo conservador de IPv6: loopback, link-local, unique-local
    if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      throw new BadRequestException(`IP ${host} es privada/interna, no permitida para webhooks`);
    }
  }
}

@Injectable()
export class SuscripcionesService {
  constructor(
    @InjectRepository(SuscripcionNotificacion) private readonly repo: Repository<SuscripcionNotificacion>,
  ) {}

  findByUser(usuarioId: string) {
    return this.repo.find({ where: { usuario_id: usuarioId }, order: { creado_en: 'DESC' } });
  }

  create(usuarioId: string, dto: SuscripcionDTO) {
    if (dto.canal === 'webhook' && dto.destino) assertSafeWebhookUrl(dto.destino);
    return this.repo.save({
      usuario_id: usuarioId,
      parque_id: dto.parque_id ?? null,
      niveles: dto.niveles,
      canal: dto.canal,
      destino: dto.destino ?? null,
      activa: dto.activa ?? true,
    });
  }

  async update(id: string, usuarioId: string, dto: Partial<SuscripcionDTO>) {
    const s = await this.repo.findOne({ where: { id, usuario_id: usuarioId } });
    if (!s) throw new NotFoundException('Suscripción no encontrada');
    const nuevoCanal = dto.canal ?? s.canal;
    const nuevoDestino = dto.destino ?? s.destino;
    if (nuevoCanal === 'webhook' && nuevoDestino) assertSafeWebhookUrl(nuevoDestino);
    Object.assign(s, {
      niveles: dto.niveles ?? s.niveles,
      canal: nuevoCanal,
      destino: nuevoDestino,
      activa: dto.activa ?? s.activa,
      parque_id: dto.parque_id === undefined ? s.parque_id : dto.parque_id,
    });
    return this.repo.save(s);
  }

  async remove(id: string, usuarioId: string) {
    const res = await this.repo.delete({ id, usuario_id: usuarioId });
    if (!res.affected) throw new NotFoundException('Suscripción no encontrada');
    return { ok: true };
  }
}
