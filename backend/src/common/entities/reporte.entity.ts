import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reportes' })
export class Reporte {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) tipo!: string | null;
  @Column({ type: 'varchar', length: 10 }) formato!: 'pdf' | 'xlsx' | 'csv';
  @Column({ name: 'ruta_minio', type: 'varchar', length: 500, nullable: true }) ruta_minio!: string | null;
  @Column({ type: 'uuid', nullable: true }) generado_por!: string | null;
  @Column({ type: 'jsonb', nullable: true }) parametros!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'creado_en' }) creado_en!: Date;
}
