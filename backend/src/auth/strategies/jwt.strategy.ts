import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => (req?.query as Record<string, string>)?.access_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('jwt.accessSecret')!,
    });
  }
  async validate(payload: { sub: string; email: string; rol: string }) {
    return { sub: payload.sub, email: payload.email, rol: payload.rol };
  }
}
