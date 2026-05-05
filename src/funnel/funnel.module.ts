import { Module } from '@nestjs/common';
import { FunnelController } from './funnel.controller.js';
import { FunnelService } from './funnel.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { LeadsModule } from '../leads/leads.module.js';
import { VideoModule } from '../common/video/video.module.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    UsersModule,
    LeadsModule,
    VideoModule,
    QueueModule,
  ],
  controllers: [FunnelController],
  providers: [FunnelService],
  exports: [FunnelService],
})
export class FunnelModule {}
