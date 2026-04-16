import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportesService } from './reportes.service';

class SolicitarReporteDto {
  @IsString() tipo!: string;
  @IsIn(['pdf', 'xlsx', 'csv']) formato!: 'pdf' | 'xlsx' | 'csv';
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  @IsOptional() @IsArray() @IsIn(['verde', 'amarillo', 'rojo'], { each: true })
  niveles?: ('verde' | 'amarillo' | 'rojo')[];
  @IsOptional() @IsUUID() parque_id?: string;
}

@ApiTags('reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly svc: ReportesService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Get(':id/download')
  async download(@Param('id', ParseUUIDPipe) id: string) {
    const url = await this.svc.presignedUrl(id);
    return { url, expira_en: '1h' };
  }

  @Roles('admin', 'operador')
  @Post()
  solicitar(@Body() dto: SolicitarReporteDto, @CurrentUser() u: JwtUser) {
    const { tipo, formato, ...params } = dto;
    return this.svc.generar(tipo, formato, u.sub, params);
  }
}
