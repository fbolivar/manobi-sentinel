import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ROLES = ['admin', 'operador', 'consulta'] as const;

export class CreateUserDto {
  @IsString() nombre!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsIn(ROLES) rol!: (typeof ROLES)[number];
}

export class UpdateUserDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsIn(ROLES) rol?: (typeof ROLES)[number];
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}
