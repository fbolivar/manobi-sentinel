import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CondicionCompuesta, ReglaAlerta } from '../common/entities/regla-alerta.entity';
import { ReglaDto, UpdateReglaDto } from './dto/regla.dto';

@Injectable()
export class ReglasService {
  constructor(@InjectRepository(ReglaAlerta) private readonly repo: Repository<ReglaAlerta>) {}

  findAll() { return this.repo.find({ order: { creado_en: 'DESC' } }); }

  async findOne(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Regla no encontrada');
    return r;
  }

  create(dto: ReglaDto) {
    return this.repo.save({
      nombre: dto.nombre ?? null,
      condicion: dto.condicion as unknown as CondicionCompuesta,
      accion: dto.accion ?? null,
      nivel_resultante: dto.nivel_resultante ?? null,
      activa: dto.activa ?? true,
    });
  }

  async update(id: string, dto: UpdateReglaDto) {
    const r = await this.findOne(id);
    Object.assign(r, {
      ...(dto.nombre !== undefined && { nombre: dto.nombre }),
      ...(dto.condicion !== undefined && { condicion: dto.condicion as unknown as CondicionCompuesta }),
      ...(dto.accion !== undefined && { accion: dto.accion }),
      ...(dto.nivel_resultante !== undefined && { nivel_resultante: dto.nivel_resultante }),
      ...(dto.activa !== undefined && { activa: dto.activa }),
    });
    return this.repo.save(r);
  }

  async remove(id: string) {
    const r = await this.findOne(id);
    await this.repo.remove(r);
    return { ok: true };
  }
}
