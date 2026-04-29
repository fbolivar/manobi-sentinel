import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParquesService } from './parques.service';
import { CreateParqueDto, UpdateParqueDto } from './dto/parque.dto';

@ApiTags('parques')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parques')
export class ParquesController {
  constructor(private readonly svc: ParquesService) {}

  @Get()
  @ApiQuery({ name: 'region', required: false })
  findAll(@Query('region') region?: string) { return this.svc.findAll(region); }

  @Get('geojson')
  geojson(@Query('region') region?: string) { return this.svc.asGeoJSON(region); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Roles('admin', 'operador')
  @Post()
  create(@Body() dto: CreateParqueDto) { return this.svc.create(dto); }

  @Roles('admin', 'operador')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateParqueDto) {
    return this.svc.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
