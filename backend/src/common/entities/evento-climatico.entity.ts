import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TipoEvento = 'lluvia' | 'incendio' | 'viento' | 'sequia' | 'inundacion' | 'temperatura' | 'humedad' | 'presion' | 'nivel_rio';

@Entity({ name: 'eventos_climaticos' })
export class EventoClimatico {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 50 }) tipo!: TipoEvento;
  @Column({ type: 'numeric', nullable: true }) intensidad!: number | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) unidad!: string | null;
  @Column({ type: 'timestamp' }) fecha!: Date;
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  ubicacion!: unknown;
  @Column({ type: 'varchar', length: 100, nullable: true }) fuente!: string | null;
  @Column({ type: 'jsonb', nullable: true }) datos_raw!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'creado_en' }) creado_en!: Date;
}
