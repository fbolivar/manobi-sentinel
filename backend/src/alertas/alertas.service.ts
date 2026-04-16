import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Alerta } from '../common/entities/alerta.entity';
import { CreateAlertaDto, CerrarAlertaDto } from './dto/alerta.dto';
import { REDIS_CLIENT } from '../redis/redis.module';

export const ALERTS_CHANNEL = 'manobi:alertas';

@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(Alerta) private readonly repo: Repository<Alerta>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  findActivas(parqueId?: string, nivel?: string) {
    const qb = this.repo.createQueryBuilder('a')
      .leftJoinAndSelect('a.parque', 'p')
      .where(`a.estado = 'activa'`)
      .orderBy(`CASE a.nivel WHEN 'rojo' THEN 1 WHEN 'amarillo' THEN 2 ELSE 3 END`, 'ASC')
      .addOrderBy('a.fecha_inicio', 'DESC');
    if (parqueId) qb.andWhere('a.parque_id = :pid', { pid: parqueId });
    if (nivel) qb.andWhere('a.nivel = :nivel', { nivel });
    return qb.getMany();
  }

  findHistorico(opts: { limit?: number; parqueId?: string; nivel?: string; desde?: string; hasta?: string }) {
    const qb = this.repo.createQueryBuilder('a')
      .leftJoinAndSelect('a.parque', 'p')
      .orderBy('a.fecha_inicio', 'DESC')
      .take(Math.min(opts.limit ?? 200, 500));
    if (opts.parqueId) qb.andWhere('a.parque_id = :pid', { pid: opts.parqueId });
    if (opts.nivel) qb.andWhere('a.nivel = :nivel', { nivel: opts.nivel });
    if (opts.desde) qb.andWhere('a.fecha_inicio >= :desde', { desde: new Date(opts.desde) });
    if (opts.hasta) qb.andWhere('a.fecha_inicio <= :hasta', { hasta: new Date(opts.hasta) });
    return qb.getMany();
  }

  async historicoStats(opts: { parqueId?: string; nivel?: string; desde?: string; hasta?: string }) {
    const qb = this.repo.createQueryBuilder('a')
      .select("DATE_TRUNC('day', a.fecha_inicio)", 'dia')
      .addSelect('a.nivel', 'nivel')
      .addSelect('COUNT(*)', 'total')
      .groupBy("DATE_TRUNC('day', a.fecha_inicio)")
      .addGroupBy('a.nivel')
      .orderBy("DATE_TRUNC('day', a.fecha_inicio)", 'ASC');
    if (opts.parqueId) qb.andWhere('a.parque_id = :pid', { pid: opts.parqueId });
    if (opts.nivel) qb.andWhere('a.nivel = :nivel', { nivel: opts.nivel });
    if (opts.desde) qb.andWhere('a.fecha_inicio >= :desde', { desde: new Date(opts.desde) });
    if (opts.hasta) qb.andWhere('a.fecha_inicio <= :hasta', { hasta: new Date(opts.hasta) });
    return qb.getRawMany();
  }

  async findOne(id: string) {
    const a = await this.repo.findOne({ where: { id }, relations: { parque: true } });
    if (!a) throw new NotFoundException('Alerta no encontrada');
    return a;
  }

  async create(dto: CreateAlertaDto, generadaPor: 'motor_reglas' | 'ia' | 'manual') {
    const existing = dto.parque_id
      ? await this.repo.findOne({
          where: { parque_id: dto.parque_id, tipo: dto.tipo, estado: 'activa' },
        })
      : null;
    if (existing) return existing;

    const alerta = this.repo.create({
      ...dto,
      fecha_inicio: new Date(dto.fecha_inicio),
      fecha_fin: dto.fecha_fin ? new Date(dto.fecha_fin) : null,
      estado: 'activa',
      generada_por: generadaPor,
    });
    const saved = await this.repo.save(alerta);
    await this.publish(saved);
    return saved;
  }

  async cerrar(id: string, dto: CerrarAlertaDto) {
    const a = await this.findOne(id);
    a.estado = dto.estado;
    a.fecha_fin = dto.fecha_fin ? new Date(dto.fecha_fin) : new Date();
    const saved = await this.repo.save(a);
    await this.publish(saved);
    return saved;
  }

  private async publish(a: Alerta) {
    await this.redis.publish(ALERTS_CHANNEL, JSON.stringify({
      id: a.id, tipo: a.tipo, nivel: a.nivel, estado: a.estado,
      parque_id: a.parque_id, descripcion: a.descripcion,
      fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin,
    }));
  }

  summary() {
    return this.repo
      .createQueryBuilder('a')
      .select('a.nivel', 'nivel').addSelect('COUNT(*)', 'total')
      .where(`a.estado = 'activa'`)
      .groupBy('a.nivel').getRawMany();
  }
}
