import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;      // user UUID
  email: string;
  role: string;
  status: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Called after JWT signature verification succeeds.
   * The returned object is attached to request.user.
   *
   * NOTE: This is the JWT payload only — a routing hint.
   * Guards MUST re-fetch the user from DB for authorization decisions.
   */
  validate(payload: JwtPayload): JwtPayload {
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };
  }
}
