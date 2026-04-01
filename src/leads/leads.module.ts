import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { MailModule } from '../mail/mail.module.js';
import { UsersModule } from '../users/users.module.js';
import { LeadsService } from './leads.service.js';
import { NurtureService } from './nurture.service.js';
import { LeadsController } from './leads.controller.js';
import { LeadsAdminController } from './leads-admin.controller.js';

@Module({
  imports: [
    PrismaModule,
    // forwardRef resolves the circular dependency:
    // AuthModule imports LeadsModule (so AuthService can call createLeadForUser)
    // LeadsModule imports AuthModule (so controllers can use JwtAuthGuard / RolesGuard)
    forwardRef(() => AuthModule),
    AuditModule,
    MailModule,
    UsersModule,
  ],
  controllers: [LeadsController, LeadsAdminController],
  providers: [LeadsService, NurtureService],
  exports: [LeadsService],
})
export class LeadsModule {}
