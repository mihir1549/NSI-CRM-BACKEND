import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL:
        configService.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000') +
        '/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user?: any) => void,
  ): Promise<void> {
    try {
      // The state param is forwarded by Google back to the callback URL as req.query.state
      const referralCode =
        (req.query?.state as string | undefined) || undefined;

      const googleUser = {
        googleId: profile.id,
        email: profile.emails[0].value,
        fullName: profile.displayName,
        emailVerified: profile.emails[0].verified,
        avatarUrl: profile.photos?.[0]?.value ?? null,
        referralCode: referralCode || undefined,
      };
      done(null, googleUser);
    } catch (error) {
      done(error, false);
    }
  }
}
