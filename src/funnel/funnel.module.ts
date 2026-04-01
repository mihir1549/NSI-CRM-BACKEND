import { Module } from '@nestjs/common';
import { FunnelController } from './funnel.controller.js';
import { FunnelService } from './funnel.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { LeadsModule } from '../leads/leads.module.js';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, UsersModule, LeadsModule],
  controllers: [FunnelController],
  providers: [FunnelService],
  exports: [FunnelService],
})
export class FunnelModule {}
