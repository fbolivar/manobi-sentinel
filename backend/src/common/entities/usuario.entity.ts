import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type Rol = 'admin' | 'operador' | 'consulta';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 255 }) nombre!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) email!: string;
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false }) password_hash!: string;
  @Column({ type: 'varchar', length: 20 }) rol!: Rol;
  @Column({ default: true }) activo!: boolean;
  @Column({ name: 'ultimo_login', type: 'timestamp', nullable: true }) ultimo_login!: Date | null;
  @CreateDateColumn({ name: 'creado_en' }) creado_en!: Date;
}
