import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { OnboardingGuard } from './guards/onboarding.guard.js';
import { UsersModule } from '../users/users.module.js';
import { OtpModule } from '../otp/otp.module.js';
import { MailModule } from '../mail/mail.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { LeadsModule } from '../leads/leads.module.js';
import { CloudinaryModule } from '../common/cloudinary/cloudinary.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN', '15m');
        // Parse duration string to seconds
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        const seconds = match
          ? parseInt(match[1], 10) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's'|'m'|'h'|'d'] ?? 900)
          : 900;
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: { expiresIn: seconds },
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    OtpModule,
    MailModule,
    AuditModule,
    TrackingModule,
    CloudinaryModule,
    forwardRef(() => LeadsModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    OnboardingGuard,
    GoogleStrategy,
  ],
  exports: [JwtAuthGuard, RolesGuard, OnboardingGuard],
})
export class AuthModule {}
