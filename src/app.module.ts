import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module.js';

import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { OtpModule } from './otp/otp.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuditModule } from './audit/audit.module.js';

// ─── Funnel Engine Modules ──────────────────────────────
import { FunnelModule } from './funnel/funnel.module.js';
import { FunnelCmsModule } from './funnel-cms/funnel-cms.module.js';
import { TrackingModule } from './tracking/tracking.module.js';

// ─── Module 3 ───────────────────────────────────────────
import { PhoneModule } from './phone/phone.module.js';
import { CouponModule } from './coupon/coupon.module.js';
import { PaymentModule } from './payment/payment.module.js';

// ─── Module 4 ───────────────────────────────────────────
import { LeadsModule } from './leads/leads.module.js';

// ─── Module 5 ───────────────────────────────────────────
import { LmsModule } from './lms/lms.module.js';

@Module({
  imports: [
    // ─── Global Config (12-factor app) ─────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ─── Global Rate Limiting ──────────────────────
    ThrottlerModule.forRoot([{
      ttl: 60000,   // 1 minute default
      limit: 100,   // 100 requests per minute default
    }]),

    // ─── Global Infrastructure ─────────────────────
    PrismaModule,

    // ─── Feature Modules ───────────────────────────
    AuthModule,
    UsersModule,
    OtpModule,
    MailModule,
    AuditModule,

    // ─── Funnel Engine ─────────────────────────────
    FunnelModule,
    FunnelCmsModule,
    TrackingModule,

    // ─── Module 3: Phone, Payment, Coupon ──────────
    PhoneModule,
    CouponModule,
    PaymentModule,

    // ─── Module 4: Lead System ─────────────────────
    ScheduleModule.forRoot(),
    LeadsModule,

    // ─── Module 5: LMS ─────────────────────────────
    LmsModule,
  ],
})
export class AppModule {}
