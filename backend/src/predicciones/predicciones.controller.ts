import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrediccionesService } from './predicciones.service';

@ApiTags('predicciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('predicciones')
export class PrediccionesController {
  constructor(private readonly svc: PrediccionesService) {}

  @Get('latest')
  latest() { return this.svc.latest(); }

  @Get('heatmap/:tipo')
  heatmap(@Param('tipo') tipo: 'incendio' | 'inundacion') { return this.svc.heatmap(tipo); }

  @Post('incendio')
  incendio(@Body() body: Record<string, unknown>) { return this.svc.predictIncendio(body); }

  @Post('inundacion')
  inundacion(@Body() body: Record<string, unknown>) { return this.svc.predictInundacion(body); }
}
