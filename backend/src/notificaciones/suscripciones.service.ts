import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuscripcionNotificacion } from '../common/entities/suscripcion.entity';

export interface SuscripcionDTO {
  parque_id?: string | null;
  niveles: ('verde' | 'amarillo' | 'rojo')[];
  canal: 'email' | 'webhook' | 'push';
  destino?: string;
  activa?: boolean;
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
    Object.assign(s, {
      niveles: dto.niveles ?? s.niveles,
      canal: dto.canal ?? s.canal,
      destino: dto.destino ?? s.destino,
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
