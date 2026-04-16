import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhoneController } from './phone.controller.js';
import { PhoneService } from './phone.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { LeadsModule } from '../leads/leads.module.js';
import { PHONE_PROVIDER_TOKEN } from './providers/phone-provider.interface.js';
import { createPhoneProvider } from './phone-provider.factory.js';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, UsersModule, LeadsModule],
  controllers: [PhoneController],
  providers: [
    {
      provide: PHONE_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) =>
        createPhoneProvider(configService),
      inject: [ConfigService],
    },
    PhoneService,
  ],
  exports: [PhoneService],
})
export class PhoneModule {}
