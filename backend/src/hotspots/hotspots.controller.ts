import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { HotspotsService } from './hotspots.service';
import { DataSource } from 'typeorm';

@ApiTags('hotspots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hotspots')
export class HotspotsController {
  constructor(
    private readonly svc: HotspotsService,
    private readonly ds: DataSource,
  ) {}

  @Get()
  async recientes(
    @Query('hours') hours?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    let rows: Record<string, unknown>[];

    if (desde || hasta) {
      const d = desde ? new Date(desde) : new Date(Date.now() - 7 * 24 * 3600_000);
      const h = hasta ? new Date(hasta) : new Date();
      rows = await this.ds.query(
        `SELECT e.id, e.intensidad AS frp, e.fecha, e.fuente,
                ST_X(e.ubicacion) AS lon, ST_Y(e.ubicacion) AS lat,
                (e.datos_raw->>'confianza')::int AS confianza,
                p.nombre AS parque_nombre
         FROM eventos_climaticos e
         LEFT JOIN parques p ON ST_Contains(p.geometria, e.ubicacion)
         WHERE e.tipo = 'incendio'
           AND (e.fuente LIKE 'ORORATECH%' OR e.fuente LIKE 'OroraTech%')
           AND e.fecha BETWEEN $1 AND $2
         ORDER BY e.fecha DESC LIMIT 2000`,
        [d.toISOString(), h.toISOString()],
      );
    } else {
      const h = Math.min(Number(hours) || 24, 168);
      rows = await this.ds.query(
        `SELECT e.id, e.intensidad AS frp, e.fecha, e.fuente,
                ST_X(e.ubicacion) AS lon, ST_Y(e.ubicacion) AS lat,
                (e.datos_raw->>'confianza')::int AS confianza,
                p.nombre AS parque_nombre
         FROM eventos_climaticos e
         LEFT JOIN parques p ON ST_Contains(p.geometria, e.ubicacion)
         WHERE e.tipo = 'incendio'
           AND (e.fuente LIKE 'ORORATECH%' OR e.fuente LIKE 'OroraTech%')
           AND e.fecha >= NOW() - ($1 || ' hours')::interval
         ORDER BY e.fecha DESC LIMIT 500`,
        [h],
      );
    }
    return {
      type: 'FeatureCollection',
      features: rows.map((r: Record<string, unknown>) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(r.lon), Number(r.lat)] },
        properties: {
          frp: Number(r.frp),
          confianza: Number(r.confianza ?? 0),
          fecha: r.fecha,
          fuente: r.fuente,
          parque: r.parque_nombre,
        },
      })),
    };
  }

  @Roles('admin', 'operador')
  @Post('poll')
  pollNow() { return this.svc.pollNow(); }
}
