import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAlertaDto {
  @IsString() tipo!: string;
  @IsIn(['verde', 'amarillo', 'rojo']) nivel!: 'verde' | 'amarillo' | 'rojo';
  @IsOptional() @IsString() descripcion?: string;
  @IsDateString() fecha_inicio!: string;
  @IsOptional() @IsDateString() fecha_fin?: string;
  @IsOptional() @IsUUID() parque_id?: string;
}

export class CerrarAlertaDto {
  @IsIn(['cerrada', 'falsa']) estado!: 'cerrada' | 'falsa';
  @IsOptional() @IsDateString() fecha_fin?: string;
}
