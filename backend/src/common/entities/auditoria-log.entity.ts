import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auditoria_logs' })
export class AuditoriaLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) usuario_id!: string | null;
  @Column({ type: 'varchar', length: 255 }) accion!: string;
  @CreateDateColumn({ name: 'fecha' }) fecha!: Date;
  @Column({ type: 'inet', nullable: true }) ip!: string | null;
  @Column({ name: 'user_agent', type: 'text', nullable: true }) user_agent!: string | null;
  @Column({ type: 'jsonb', nullable: true }) detalle!: Record<string, unknown> | null;
  @Column({ type: 'varchar', length: 20 }) resultado!: 'exito' | 'error';
}
