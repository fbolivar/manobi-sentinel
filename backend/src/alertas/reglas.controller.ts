import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReglaDto, UpdateReglaDto } from './dto/regla.dto';
import { ReglasService } from './reglas.service';

@ApiTags('reglas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reglas')
export class ReglasController {
  constructor(private readonly svc: ReglasService) {}

  @Get() findAll() { return this.svc.findAll(); }

  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Roles('admin')
  @Post() create(@Body() dto: ReglaDto) { return this.svc.create(dto); }

  @Roles('admin')
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReglaDto) {
    return this.svc.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
