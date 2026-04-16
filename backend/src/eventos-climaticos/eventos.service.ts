import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventoClimatico } from '../common/entities/evento-climatico.entity';
import { CreateEventoDto } from './dto/evento.dto';

@Injectable()
export class EventosService {
  constructor(
    @InjectRepository(EventoClimatico) private readonly repo: Repository<EventoClimatico>,
    private readonly ds: DataSource,
  ) {}

  findRecent(hours = 24, tipo?: string) {
    const qb = this.repo.createQueryBuilder('e')
      .where(`e.fecha >= NOW() - (:hours || ' hours')::interval`, { hours })
      .orderBy('e.fecha', 'DESC');
    if (tipo) qb.andWhere('e.tipo = :tipo', { tipo });
    return qb.getMany();
  }

  async create(dto: CreateEventoDto) {
    const id = (await this.ds.query(
      `INSERT INTO eventos_climaticos (tipo, intensidad, unidad, fecha, ubicacion, fuente, datos_raw)
       VALUES ($1,$2,$3,$4,
         CASE WHEN $5::json IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($5), 4326) END,
         $6, $7) RETURNING id`,
      [dto.tipo, dto.intensidad ?? null, dto.unidad ?? null, dto.fecha,
       dto.ubicacion ? JSON.stringify(dto.ubicacion) : null,
       dto.fuente ?? null, dto.datos_raw ? JSON.stringify(dto.datos_raw) : null],
    ))[0].id as string;
    return this.repo.findOne({ where: { id } });
  }

  async createMany(dtos: CreateEventoDto[]): Promise<number> {
    if (dtos.length === 0) return 0;
    const CHUNK = 200;
    let total = 0;
    for (let i = 0; i < dtos.length; i += CHUNK) {
      const batch = dtos.slice(i, i + CHUNK);
      const values: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      for (const d of batch) {
        values.push(
          `($${p++},$${p++},$${p++},$${p++},` +
          `CASE WHEN $${p}::json IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($${p++}), 4326) END,` +
          `$${p++},$${p++})`,
        );
        params.push(
          d.tipo,
          d.intensidad ?? null,
          d.unidad ?? null,
          d.fecha,
          d.ubicacion ? JSON.stringify(d.ubicacion) : null,
          d.fuente ?? null,
          d.datos_raw ? JSON.stringify(d.datos_raw) : null,
        );
      }
      const sql =
        `INSERT INTO eventos_climaticos (tipo, intensidad, unidad, fecha, ubicacion, fuente, datos_raw)
         VALUES ${values.join(',')}`;
      const res = (await this.ds.query(sql + ' RETURNING id', params)) as unknown[];
      total += res.length;
    }
    return total;
  }

  /** Lee contexto del caché si tiene < 20 min; si no, calcula y guarda. */
  async contextoPorParque(parqueId: string): Promise<Record<string, number | string | null>> {
    const cached = (await this.ds.query(
      `SELECT * FROM contexto_parque_cache WHERE parque_id = $1 AND updated_at >= NOW() - INTERVAL '20 minutes'`,
      [parqueId],
    ))[0] as Record<string, unknown> | undefined;

    if (cached) {
      return {
        lluvia_24h_mm: Number(cached.lluvia_24h_mm ?? 0),
        lluvia_1h_mm: Number(cached.lluvia_1h_mm ?? 0),
        viento_kmh: Number(cached.viento_kmh ?? 0),
        temperatura_c: Number(cached.temperatura_c ?? 25),
        humedad_relativa: Number(cached.humedad_relativa ?? 75),
        dias_sin_lluvia: Number(cached.dias_sin_lluvia ?? 2),
        'parque.nivel_riesgo': (cached.nivel_riesgo as string) ?? null,
      };
    }

    return this.calcContexto(parqueId);
  }

  private async calcContexto(parqueId: string): Promise<Record<string, number | string | null>> {
    const row = (await this.ds.query(
      `WITH pq AS (SELECT geometria, nivel_riesgo FROM parques WHERE id = $1),
       dentro AS (
         SELECT e.*
         FROM eventos_climaticos e, pq
         WHERE ST_Intersects(pq.geometria, e.ubicacion)
           AND e.fecha >= NOW() - INTERVAL '24 hours'
       ),
       cercanos_tyh AS (
         SELECT e.tipo, e.intensidad
         FROM eventos_climaticos e, pq
         WHERE e.tipo IN ('temperatura','humedad')
           AND e.fecha >= NOW() - INTERVAL '24 hours'
           AND ST_DWithin(pq.geometria, e.ubicacion, 1.5)
       )
       SELECT
         COALESCE((SELECT SUM(intensidad) FROM dentro WHERE tipo='lluvia'), 0) AS lluvia_24h_mm,
         COALESCE((SELECT SUM(intensidad) FROM dentro WHERE tipo='lluvia' AND fecha >= NOW() - INTERVAL '1 hour'), 0) AS lluvia_1h_mm,
         COALESCE((SELECT AVG(intensidad) FROM dentro WHERE tipo='viento'), 0) AS viento_kmh,
         COALESCE(
           (SELECT AVG(intensidad) FROM dentro WHERE tipo='temperatura'),
           (SELECT AVG(intensidad) FROM cercanos_tyh WHERE tipo='temperatura'),
           (SELECT MAX((datos_raw->>'temperatura_c')::numeric) FROM dentro)
         ) AS temperatura_c,
         COALESCE(
           (SELECT AVG(intensidad) FROM dentro WHERE tipo='humedad'),
           (SELECT AVG(intensidad) FROM cercanos_tyh WHERE tipo='humedad'),
           (SELECT MIN((datos_raw->>'humedad_relativa')::numeric) FROM dentro)
         ) AS humedad_relativa,
         (SELECT nivel_riesgo FROM pq) AS parque_nivel_riesgo`,
      [parqueId],
    ))[0] as Record<string, string>;
    const dsl = (await this.ds.query(
      `SELECT
         COUNT(*) AS n,
         EXTRACT(EPOCH FROM (NOW() - MAX(e.fecha)))/86400 AS dias
       FROM eventos_climaticos e, parques p
       WHERE p.id = $1 AND e.tipo = 'lluvia' AND ST_Intersects(p.geometria, e.ubicacion)`,
      [parqueId],
    ))[0] as { n: string; dias: string | null };
    const ctx = {
      lluvia_24h_mm: Number(row?.lluvia_24h_mm ?? 0),
      lluvia_1h_mm: Number(row?.lluvia_1h_mm ?? 0),
      viento_kmh: Number(row?.viento_kmh ?? 0),
      temperatura_c: row?.temperatura_c != null ? Number(row.temperatura_c) : 25,
      humedad_relativa: row?.humedad_relativa != null ? Number(row.humedad_relativa) : 75,
      dias_sin_lluvia: Number(dsl?.n ?? 0) === 0
        ? 2
        : Math.max(0, Math.floor(Number(dsl?.dias ?? 0))),
      'parque.nivel_riesgo': row?.parque_nivel_riesgo ?? null,
    };

    await this.ds.query(
      `INSERT INTO contexto_parque_cache (parque_id, lluvia_24h_mm, lluvia_1h_mm, viento_kmh, temperatura_c, humedad_relativa, dias_sin_lluvia, nivel_riesgo, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (parque_id) DO UPDATE SET
         lluvia_24h_mm=EXCLUDED.lluvia_24h_mm, lluvia_1h_mm=EXCLUDED.lluvia_1h_mm,
         viento_kmh=EXCLUDED.viento_kmh, temperatura_c=EXCLUDED.temperatura_c,
         humedad_relativa=EXCLUDED.humedad_relativa, dias_sin_lluvia=EXCLUDED.dias_sin_lluvia,
         nivel_riesgo=EXCLUDED.nivel_riesgo, updated_at=NOW()`,
      [parqueId, ctx.lluvia_24h_mm, ctx.lluvia_1h_mm, ctx.viento_kmh,
       ctx.temperatura_c, ctx.humedad_relativa, ctx.dias_sin_lluvia,
       ctx['parque.nivel_riesgo']],
    ).catch(() => {});

    return ctx;
  }
}
