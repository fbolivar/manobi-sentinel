import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Parque } from '../common/entities/parque.entity';
import { CreateParqueDto, UpdateParqueDto } from './dto/parque.dto';

@Injectable()
export class ParquesService {
  constructor(
    @InjectRepository(Parque) private readonly repo: Repository<Parque>,
    private readonly ds: DataSource,
  ) {}

  async findAll(region?: string) {
    const qb = this.repo.createQueryBuilder('p')
      .select(['p.id', 'p.nombre', 'p.region', 'p.nivel_riesgo', 'p.area_ha', 'p.descripcion', 'p.creado_en'])
      .orderBy('p.nombre', 'ASC');
    if (region) qb.andWhere('p.region = :region', { region });
    return qb.getMany();
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Parque no encontrado');
    return p;
  }

  async asGeoJSON(region?: string): Promise<GeoJSON.FeatureCollection> {
    const params: unknown[] = [];
    let where = '';
    if (region) { params.push(region); where = `WHERE region = $1`; }
    // Simplificación: tolerancia 0.001° (~100m) es imperceptible al zoom máximo del mapa nacional
    // y reduce el payload GeoJSON de ~47MB a <5MB para 73 parques.
    // Precisión 5 decimales (~1m) es más que suficiente para visualización.
    const rows = await this.ds.query<{ feature: GeoJSON.Feature }[]>(
      `SELECT json_build_object(
          'type', 'Feature',
          'id', id,
          'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometria, 0.001), 5)::json,
          'properties', json_build_object(
             'nombre', nombre, 'region', region,
             'nivel_riesgo', nivel_riesgo, 'area_ha', area_ha,
             'descripcion', descripcion)
       ) AS feature FROM parques ${where}`,
      params,
    );
    return { type: 'FeatureCollection', features: rows.map((r) => r.feature) };
  }

  async create(dto: CreateParqueDto) {
    const id = (await this.ds.query(
      `INSERT INTO parques (nombre, region, nivel_riesgo, area_ha, descripcion, geometria)
       VALUES ($1,$2,$3,$4,$5, CASE WHEN $6::json IS NULL THEN NULL ELSE ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)) END)
       RETURNING id`,
      [dto.nombre, dto.region ?? null, dto.nivel_riesgo ?? null,
       dto.area_ha ?? null, dto.descripcion ?? null,
       dto.geometria ? JSON.stringify(dto.geometria) : null],
    ))[0].id as string;
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateParqueDto) {
    await this.findOne(id);
    await this.ds.query(
      `UPDATE parques SET
         nombre = COALESCE($2, nombre),
         region = COALESCE($3, region),
         nivel_riesgo = COALESCE($4, nivel_riesgo),
         area_ha = COALESCE($5, area_ha),
         descripcion = COALESCE($6, descripcion),
         geometria = COALESCE(
            CASE WHEN $7::json IS NULL THEN NULL
                 ELSE ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($7), 4326)) END,
            geometria)
       WHERE id = $1`,
      [id, dto.nombre ?? null, dto.region ?? null, dto.nivel_riesgo ?? null,
       dto.area_ha ?? null, dto.descripcion ?? null,
       dto.geometria ? JSON.stringify(dto.geometria) : null],
    );
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete({ id });
    return { ok: true };
  }
}
