import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OtpService } from './otp.service.js';

@Module({
  imports: [PrismaModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
