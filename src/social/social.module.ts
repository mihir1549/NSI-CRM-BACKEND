import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { GeminiModule } from '../common/gemini/gemini.module.js';
import { SocialPostService } from './social-post.service.js';
import { SocialCronService } from './social-cron.service.js';
import { SocialPreferenceService } from './social-preference.service.js';
import { SocialConfigService } from './social-config.service.js';
import { SocialController } from './social.controller.js';
import { MetaLeadService } from './meta-lead.service.js';
import { MetaLeadController } from './meta-lead.controller.js';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    UsersModule,
    GeminiModule,
  ],
  controllers: [SocialController, MetaLeadController],
  providers: [
    SocialPostService,
    SocialCronService,
    SocialPreferenceService,
    SocialConfigService,
    MetaLeadService,
  ],
  exports: [
    SocialPostService,
    SocialPreferenceService,
    SocialConfigService,
    MetaLeadService,
  ],
})
export class SocialModule {}
