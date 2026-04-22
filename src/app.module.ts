import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import Redis from 'ioredis';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';

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

// ─── Module 7 ───────────────────────────────────────────
import { AdminModule } from './admin/admin.module.js';

// ─── Module 6: Distributor ──────────────────────────────
import { DistributorModule } from './distributor/distributor.module.js';
import { InvoiceModule } from './common/invoice/invoice.module.js';
import { StorageModule } from './common/storage/storage.module.js';

// ─── Module 8: Broadcast & Announcements ────────────────
import { BroadcastModule } from './broadcast/broadcast.module.js';
import { SseModule } from './sse/sse.module.js';

@Module({
  imports: [
    // ─── Global Config (12-factor app) ─────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ─── Global Rate Limiting ──────────────────────
    // Conditional Redis storage — in-memory fallback when REDIS_ENABLED=false.
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const throttlers = [
          { name: 'default', ttl: 60000, limit: 100 }, // 100/min baseline
          { name: 'strict', ttl: 3600000, limit: 5 }, // 5/hr sensitive
        ];
        if (process.env.REDIS_ENABLED !== 'true') {
          return { throttlers };
        }
        const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        return {
          throttlers,
          storage: new ThrottlerStorageRedisService(redis),
        };
      },
    }),

    // ─── Global Caching ────────────────────────────
    // Conditional Redis store — in-memory fallback when REDIS_ENABLED=false.
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const stores =
          process.env.REDIS_ENABLED === 'true'
            ? [new KeyvRedis(process.env.REDIS_URL || 'redis://localhost:6379')]
            : undefined;
        return { ttl: 300000, stores };
      },
    }),

    // ─── Global Infrastructure ─────────────────────
    PrismaModule,
    RedisModule,

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

    // ─── Module 6: Distributor ─────────────────────
    DistributorModule,
    InvoiceModule,
    StorageModule,

    // ─── Module 7: Admin ───────────────────────────
    AdminModule,

    // ─── Module 8: Broadcast & Announcements ───────
    BroadcastModule,
    SseModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
