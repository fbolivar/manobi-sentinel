import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AlertasService } from './alertas.service';
import { CerrarAlertaDto, CreateAlertaDto } from './dto/alerta.dto';

@ApiTags('alertas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alertas')
export class AlertasController {
  constructor(private readonly svc: AlertasService) {}

  @Get()
  activas(@Query('parque_id') parqueId?: string, @Query('nivel') nivel?: string) {
    return this.svc.findActivas(parqueId, nivel);
  }

  @Get('historico')
  historico(
    @Query('limit') limit?: string,
    @Query('parque_id') parqueId?: string,
    @Query('nivel') nivel?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.svc.findHistorico({
      limit: limit ? Number(limit) : 200,
      parqueId, nivel, desde, hasta,
    });
  }

  @Get('historico/stats')
  historicoStats(
    @Query('parque_id') parqueId?: string,
    @Query('nivel') nivel?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.svc.historicoStats({ parqueId, nivel, desde, hasta });
  }

  @Get('summary')
  summary() { return this.svc.summary(); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Roles('admin', 'operador')
  @Post()
  create(@Body() dto: CreateAlertaDto) { return this.svc.create(dto, 'manual'); }

  @Roles('admin', 'operador')
  @Patch(':id/cerrar')
  cerrar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CerrarAlertaDto) {
    return this.svc.cerrar(id, dto);
  }
}
