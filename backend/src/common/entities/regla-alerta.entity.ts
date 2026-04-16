import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type Comparador = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in';
export type Operador = 'AND' | 'OR';

export interface CondicionHoja {
  campo: string;
  comparador: Comparador;
  valor: unknown;
}
export interface CondicionCompuesta {
  operador: Operador;
  condiciones: Array<CondicionHoja | CondicionCompuesta>;
}

@Entity({ name: 'reglas_alerta' })
export class ReglaAlerta {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) nombre!: string | null;
  @Column({ type: 'jsonb' }) condicion!: CondicionCompuesta;
  @Column({ type: 'text', nullable: true }) accion!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) nivel_resultante!: 'verde' | 'amarillo' | 'rojo' | null;
  @Column({ default: true }) activa!: boolean;
  @CreateDateColumn({ name: 'creado_en' }) creado_en!: Date;
}
