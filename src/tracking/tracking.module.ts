import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TrackingController } from './tracking.controller.js';
import { TrackingService } from './tracking.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        name: 'tracking',
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
