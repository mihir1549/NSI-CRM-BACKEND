import { Module } from '@nestjs/common';
import {
  CouponAdminController,
  CouponController,
} from './coupon.controller.js';
import { CouponService } from './coupon.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [CouponAdminController, CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
