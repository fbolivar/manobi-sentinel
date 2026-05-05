import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportesService } from './reportes.service';

class EntradaCronologicaDto {
  @IsString() fecha!: string;
  @IsOptional() @IsNumber() focos?: number;
  @IsString() texto!: string;
}

class SolicitarIncendioDto {
  @IsNumber() numero_seguimiento!: number;
  @IsString() fecha_reporte!: string;
  @IsString() area_protegida!: string;
  @IsString() municipio_departamento!: string;
  @IsString() estado_actual!: string;
  @IsString() elaborado_por!: string;
  @IsOptional() @IsNumber() cobertura_ha?: number;
  @IsString() cobertura_descripcion!: string;
  @ValidateNested({ each: true }) @Type(() => EntradaCronologicaDto) reportes_campo!: EntradaCronologicaDto[];
  @IsOptional() @IsString() notas?: string;
  @ValidateNested({ each: true }) @Type(() => EntradaCronologicaDto) monitoreo_satelital!: EntradaCronologicaDto[];
  @ValidateNested({ each: true }) @Type(() => EntradaCronologicaDto) intervenciones!: EntradaCronologicaDto[];
  @IsOptional() @IsString() fauna_afectada?: string;
}

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
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { stream, filename, contentType } = await this.svc.downloadStream(id);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    stream.pipe(res);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }

  @Roles('admin', 'operador')
  @Post()
  solicitar(@Body() dto: SolicitarReporteDto, @CurrentUser() u: JwtUser) {
    const { tipo, formato, ...params } = dto;
    return this.svc.generar(tipo, formato, u.sub, params);
  }

  @Roles('admin', 'operador')
  @Post('incendio')
  solicitarIncendio(@Body() dto: SolicitarIncendioDto, @CurrentUser() u: JwtUser) {
    return this.svc.generarIncendio(u.sub, dto);
  }
}
