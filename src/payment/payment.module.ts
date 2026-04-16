import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentController } from './payment.controller.js';
import { WebhookController } from './webhook.controller.js';
import { PaymentService } from './payment.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { CouponModule } from '../coupon/coupon.module.js';
import { UsersModule } from '../users/users.module.js';
import { PAYMENT_PROVIDER_TOKEN } from './providers/payment-provider.interface.js';
import { createPaymentProvider } from './payment-provider.factory.js';
import { InvoiceModule } from '../common/invoice/invoice.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    CouponModule,
    UsersModule,
    InvoiceModule,
  ],
  controllers: [PaymentController, WebhookController],
  providers: [
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) =>
        createPaymentProvider(configService),
      inject: [ConfigService],
    },
    PaymentService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
