import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CampaignService } from './campaign.service.js';

@Module({
  imports: [PrismaModule],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
