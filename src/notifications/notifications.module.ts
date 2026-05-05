import { Global, Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service.js';
import { LeadAlertService } from './lead-alert.service.js';

@Global()
@Module({
  providers: [WhatsAppService, LeadAlertService],
  exports: [WhatsAppService, LeadAlertService],
})
export class NotificationsModule {}
