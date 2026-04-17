import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

export class RefreshDto {
  @IsString() refresh_token!: string;
}

export class LogoutDto {
  @IsOptional() @IsString() refresh_token?: string;
}
