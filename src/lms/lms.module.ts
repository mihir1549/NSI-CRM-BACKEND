import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { MailModule } from '../mail/mail.module.js';
import { StorageModule } from '../common/storage/storage.module.js';
import { PAYMENT_PROVIDER_TOKEN } from '../payment/providers/payment-provider.interface.js';
import { createPaymentProvider } from '../payment/payment-provider.factory.js';
import { VideoModule } from '../common/video/video.module.js';
import { CouponModule } from '../coupon/coupon.module.js';
import { CoursesAdminController } from './courses-admin.controller.js';
import { CoursesUserController } from './courses-user.controller.js';
import { LmsUploadController } from './lms-upload.controller.js';
import { CoursesAdminService } from './courses-admin.service.js';
import { CoursesUserService } from './courses-user.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { CertificateService } from './certificate.service.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    MailModule,
    StorageModule,
    VideoModule,
    CouponModule,
  ],
  controllers: [
    CoursesAdminController,
    CoursesUserController,
    LmsUploadController,
  ],
  providers: [
    // Re-provide payment provider (same factory used in PaymentModule)
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) =>
        createPaymentProvider(configService),
      inject: [ConfigService],
    },
    CoursesAdminService,
    CoursesUserService,
    EnrollmentService,
    CertificateService,
  ],
  exports: [EnrollmentService],
})
export class LmsModule {}
