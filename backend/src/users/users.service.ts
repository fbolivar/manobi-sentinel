import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../common/entities/usuario.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
    private readonly cfg: ConfigService,
  ) {}

  findAll() { return this.repo.find({ order: { creado_en: 'DESC' } }); }
  async findById(id: string) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.repo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email ya registrado');
    const rounds = this.cfg.get<number>('bcryptRounds')!;
    const u = this.repo.create({
      nombre: dto.nombre,
      email: dto.email,
      rol: dto.rol,
      password_hash: await bcrypt.hash(dto.password, rounds),
      activo: true,
    });
    return this.repo.save(u);
  }

  async update(id: string, dto: UpdateUserDto) {
    const u = await this.findById(id);
    if (dto.password) {
      const rounds = this.cfg.get<number>('bcryptRounds')!;
      u.password_hash = await bcrypt.hash(dto.password, rounds);
    }
    Object.assign(u, {
      nombre: dto.nombre ?? u.nombre,
      rol: dto.rol ?? u.rol,
      activo: dto.activo ?? u.activo,
    });
    return this.repo.save(u);
  }

  async remove(id: string) {
    const u = await this.findById(id);
    u.activo = false;
    return this.repo.save(u);
  }
}
