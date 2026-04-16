import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { SuscripcionesService } from './suscripciones.service';

class SuscripcionDto {
  @IsOptional() @IsUUID() parque_id?: string;
  @IsArray() @IsIn(['verde', 'amarillo', 'rojo'], { each: true })
  niveles!: ('verde' | 'amarillo' | 'rojo')[];
  @IsIn(['email', 'webhook', 'push']) canal!: 'email' | 'webhook' | 'push';
  @IsOptional() @IsString() destino?: string;
  @IsOptional() @IsBoolean() activa?: boolean;
}

@ApiTags('suscripciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suscripciones')
export class SuscripcionesController {
  constructor(private readonly svc: SuscripcionesService) {}

  @Get()
  mine(@CurrentUser() u: JwtUser) { return this.svc.findByUser(u.sub); }

  @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: SuscripcionDto) {
    return this.svc.create(u.sub, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtUser, @Body() dto: SuscripcionDto) {
    return this.svc.update(id, u.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtUser) {
    return this.svc.remove(id, u.sub);
  }
}
