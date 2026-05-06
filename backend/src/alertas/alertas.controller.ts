import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AlertasService } from './alertas.service';
import { CerrarAlertaDto, CreateAlertaDto } from './dto/alerta.dto';

const NIVELES = ['verde', 'amarillo', 'rojo'] as const;
const ESTADOS = ['activa', 'cerrada', 'resuelta'] as const;

class AlertasQueryDto {
  @IsOptional() @IsUUID() parque_id?: string;
  @IsOptional() @IsIn(NIVELES) nivel?: string;
}

class HistoricoQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(1000) @Type(() => Number) limit?: number;
  @IsOptional() @IsUUID() parque_id?: string;
  @IsOptional() @IsIn(NIVELES) nivel?: string;
  @IsOptional() @IsIn(ESTADOS) estado?: string;
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}

class StatsQueryDto {
  @IsOptional() @IsUUID() parque_id?: string;
  @IsOptional() @IsIn(NIVELES) nivel?: string;
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}

@ApiTags('alertas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alertas')
export class AlertasController {
  constructor(private readonly svc: AlertasService) {}

  @Get()
  activas(@Query() q: AlertasQueryDto) {
    return this.svc.findActivas(q.parque_id, q.nivel);
  }

  @Get('historico')
  historico(@Query() q: HistoricoQueryDto) {
    return this.svc.findHistorico({
      limit: q.limit ?? 200,
      parqueId: q.parque_id, nivel: q.nivel, estado: q.estado, desde: q.desde, hasta: q.hasta,
    });
  }

  @Get('historico/stats')
  historicoStats(@Query() q: StatsQueryDto) {
    return this.svc.historicoStats({ parqueId: q.parque_id, nivel: q.nivel, desde: q.desde, hasta: q.hasta });
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
