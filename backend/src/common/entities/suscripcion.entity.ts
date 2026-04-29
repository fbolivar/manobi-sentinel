import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'suscripciones_notificacion' })
export class SuscripcionNotificacion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) usuario_id!: string;
  @Column({ type: 'uuid', nullable: true }) parque_id!: string | null;
  @Column({ type: 'varchar', array: true, default: () => "ARRAY['rojo']::varchar[]" })
  niveles!: string[];
  @Column({ type: 'varchar', length: 20 }) canal!: 'email' | 'webhook' | 'push';
  @Column({ type: 'varchar', length: 500, nullable: true }) destino!: string | null;
  @Column({ default: true }) activa!: boolean;
  @CreateDateColumn({ name: 'creado_en' }) creado_en!: Date;
}
