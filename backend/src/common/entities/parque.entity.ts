import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Alerta } from './alerta.entity';

export type NivelRiesgo = 'bajo' | 'medio' | 'alto';

@Entity({ name: 'parques' })
export class Parque {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 255 }) nombre!: string;
  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326, nullable: true })
  geometria!: unknown;
  @Column({ type: 'varchar', length: 100, nullable: true }) region!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) nivel_riesgo!: NivelRiesgo | null;
  @Column({ type: 'numeric', nullable: true }) area_ha!: number | null;
  @Column({ type: 'text', nullable: true }) descripcion!: string | null;
  @CreateDateColumn({ name: 'creado_en' }) creado_en!: Date;
  @OneToMany(() => Alerta, (a) => a.parque) alertas!: Alerta[];
}
