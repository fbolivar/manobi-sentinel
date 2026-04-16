import { IsIn, IsNumber, IsOptional, IsString, IsObject } from 'class-validator';

const NIVELES = ['bajo', 'medio', 'alto'] as const;

export class CreateParqueDto {
  @IsString() nombre!: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsIn(NIVELES) nivel_riesgo?: (typeof NIVELES)[number];
  @IsOptional() @IsNumber() area_ha?: number;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsObject() geometria?: GeoJSON.MultiPolygon;
}
export class UpdateParqueDto extends CreateParqueDto {
  @IsOptional() @IsString() declare nombre: string;
}
