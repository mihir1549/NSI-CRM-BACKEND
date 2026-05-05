import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { SocialPostService } from './social-post.service.js';
import { SocialPreferenceService } from './social-preference.service.js';
import { UpdatePreferenceDto } from './dto/update-preference.dto.js';

@Controller({ path: 'social', version: '1' })
export class SocialController {
  constructor(
    private readonly socialPostService: SocialPostService,
    private readonly socialPreferenceService: SocialPreferenceService,
  ) {}

  // ── Distributor: static routes first ─────────────────────────────────────

  @Get('languages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN')
  getAvailableLanguages() {
    return this.socialPreferenceService.getAvailableLanguages();
  }

  @Get('topics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN')
  getAvailableTopics() {
    return this.socialPreferenceService.getAvailableTopics();
  }

  @Get('my-posts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getMyPosts(
    @CurrentUser() user: JwtPayload,
    @Query('filter') filter?: string,
  ) {
    const validFilter = ['today', '7days', '30days', 'all'].includes(
      filter ?? '',
    )
      ? (filter as 'today' | '7days' | '30days' | 'all')
      : 'today';

    return this.socialPostService.getMyPosts(user.sub, validFilter);
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getPreference(@CurrentUser() user: JwtPayload) {
    return this.socialPreferenceService.getPreference(user.sub);
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  upsertPreference(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.socialPreferenceService.upsertPreference(user.sub, dto);
  }

  // ── Admin: static routes before parameterized ─────────────────────────────

  @Get('admin/posts/failed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getFailedPostsAdmin() {
    return this.socialPostService.getFailedPostsAdmin();
  }

  @Get('admin/posts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getAllPostsAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page ?? '1', 10) || 1;
    const limitNum = parseInt(limit ?? '20', 10) || 20;
    return this.socialPostService.getAllPostsAdmin(pageNum, limitNum);
  }

  @Post('admin/generate/:distributorUuid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async triggerGeneration(@Param('distributorUuid') distributorUuid: string) {
    await this.socialPostService.generatePostsForDistributor(distributorUuid);
    return { message: 'Generation triggered successfully' };
  }
}
