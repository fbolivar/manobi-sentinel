import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EventosService } from './eventos.service';
import { CreateEventoDto } from './dto/evento.dto';

@ApiTags('eventos-climaticos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('eventos-climaticos')
export class EventosController {
  constructor(private readonly svc: EventosService) {}

  @Get()
  findRecent(@Query('hours') hours?: string, @Query('tipo') tipo?: string) {
    return this.svc.findRecent(hours ? Number(hours) : 24, tipo);
  }

  @Roles('admin', 'operador')
  @Post()
  create(@Body() dto: CreateEventoDto) { return this.svc.create(dto); }
}
