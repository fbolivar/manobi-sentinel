import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ReglaDto {
  @IsOptional() @IsString() nombre?: string;
  @IsObject() condicion!: Record<string, unknown>;
  @IsOptional() @IsString() accion?: string;
  @IsOptional() @IsIn(['verde', 'amarillo', 'rojo']) nivel_resultante?: 'verde' | 'amarillo' | 'rojo';
  @IsOptional() @IsBoolean() activa?: boolean;
}

export class UpdateReglaDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsObject() condicion?: Record<string, unknown>;
  @IsOptional() @IsString() accion?: string;
  @IsOptional() @IsIn(['verde', 'amarillo', 'rojo']) nivel_resultante?: 'verde' | 'amarillo' | 'rojo';
  @IsOptional() @IsBoolean() activa?: boolean;
}
