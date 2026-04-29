import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuditoriaLog } from './entities/auditoria-log.entity';

@ApiTags('auditoria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('auditoria')
export class AuditoriaController {
  constructor(
    @InjectRepository(AuditoriaLog) private readonly repo: Repository<AuditoriaLog>,
  ) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'usuario_id', required: false })
  @ApiQuery({ name: 'resultado', required: false })
  async findAll(
    @Query('limit') limit = '100',
    @Query('offset') offset = '0',
    @Query('usuario_id') usuario_id?: string,
    @Query('resultado') resultado?: string,
  ) {
    const qb = this.repo.createQueryBuilder('a')
      .orderBy('a.fecha', 'DESC')
      .limit(Math.min(Number(limit), 500))
      .offset(Number(offset));

    if (usuario_id) qb.andWhere('a.usuario_id = :uid', { uid: usuario_id });
    if (resultado) qb.andWhere('a.resultado = :res', { res: resultado });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
