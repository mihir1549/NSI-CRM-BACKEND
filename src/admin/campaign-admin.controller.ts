import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CampaignService } from '../campaign/campaign.service.js';
import { CreateCampaignDto } from '../campaign/dto/create-campaign.dto.js';
import { UpdateCampaignDto } from '../campaign/dto/update-campaign.dto.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * CampaignAdminController — Super Admin campaign management.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 * Admin can see and manage ALL campaigns across all owners.
 */
@Controller({ path: 'admin/campaigns', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CampaignAdminController {
  constructor(private readonly campaignService: CampaignService) {}

  /**
   * GET /api/v1/admin/campaigns
   * List all campaigns across all owners.
   */
  @Get()
  listCampaigns(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.campaignService.listCampaigns(user.sub, 'ADMIN');
  }

  /**
   * POST /api/v1/admin/campaigns
   * Create a new admin-owned campaign.
   */
  @Post()
  createCampaign(@Req() req: Request, @Body() dto: CreateCampaignDto) {
    const user = req.user as JwtPayload;
    return this.campaignService.createCampaign(user.sub, 'ADMIN', dto);
  }

  /**
   * GET /api/v1/admin/campaigns/:uuid
   * Get campaign detail + analytics.
   */
  @Get(':uuid')
  getCampaign(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.campaignService.getCampaign(uuid, user.sub, 'ADMIN');
  }

  /**
   * PATCH /api/v1/admin/campaigns/:uuid
   * Update any campaign.
   */
  @Patch(':uuid')
  updateCampaign(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const user = req.user as JwtPayload;
    return this.campaignService.updateCampaign(uuid, user.sub, 'ADMIN', dto);
  }

  /**
   * DELETE /api/v1/admin/campaigns/:uuid
   * Delete any campaign.
   */
  @Delete(':uuid')
  deleteCampaign(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.campaignService.deleteCampaign(uuid, user.sub, 'ADMIN');
  }
}
