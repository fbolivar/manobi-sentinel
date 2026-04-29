import { IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

const TIPOS = ['lluvia', 'incendio', 'viento', 'sequia', 'inundacion', 'temperatura', 'humedad', 'presion', 'nivel_rio'] as const;

export class CreateEventoDto {
  @IsIn(TIPOS) tipo!: (typeof TIPOS)[number];
  @IsOptional() @IsNumber() intensidad?: number;
  @IsOptional() @IsString() unidad?: string;
  @IsDateString() fecha!: string;
  @IsOptional() @IsObject() ubicacion?: GeoJSON.Point;
  @IsOptional() @IsString() fuente?: string;
  @IsOptional() @IsObject() datos_raw?: Record<string, unknown>;
}
