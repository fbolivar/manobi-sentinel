import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

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

export class VerifyOtpDto {
  @IsString() challenge_id!: string;
  @IsString() @Length(6, 6) @Matches(/^\d{6}$/, { message: 'El código debe ser de 6 dígitos' })
  code!: string;
}

export class ResendOtpDto {
  @IsString() challenge_id!: string;
}
