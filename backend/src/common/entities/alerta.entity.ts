import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Parque } from './parque.entity';

export type NivelAlerta = 'verde' | 'amarillo' | 'rojo';
export type EstadoAlerta = 'activa' | 'cerrada' | 'falsa';
export type GeneradaPor = 'motor_reglas' | 'ia' | 'manual';

@Entity({ name: 'alertas' })
export class Alerta {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 100 }) tipo!: string;
  @Column({ type: 'varchar', length: 20 }) nivel!: NivelAlerta;
  @Column({ type: 'text', nullable: true }) descripcion!: string | null;
  @Column({ type: 'timestamp' }) fecha_inicio!: Date;
  @Column({ type: 'timestamp', nullable: true }) fecha_fin!: Date | null;
  @Column({ type: 'uuid', nullable: true }) parque_id!: string | null;
  @ManyToOne(() => Parque, (p) => p.alertas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parque_id' })
  parque!: Parque;
  @Column({ type: 'varchar', length: 20 }) estado!: EstadoAlerta;
  @Column({ type: 'varchar', length: 50, nullable: true }) generada_por!: GeneradaPor | null;
  @CreateDateColumn({ name: 'creado_en' }) creado_en!: Date;
}
