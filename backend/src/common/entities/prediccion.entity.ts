import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'predicciones' })
export class Prediccion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 50 }) tipo!: 'incendio' | 'inundacion';
  @Column({ type: 'numeric' }) probabilidad!: number;
  @Column({ type: 'timestamp' }) fecha!: Date;
  @Column({ type: 'uuid', nullable: true }) parque_id!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) modelo_version!: string | null;
  @Column({ type: 'jsonb', nullable: true }) parametros!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'creado_en' }) creado_en!: Date;
}
