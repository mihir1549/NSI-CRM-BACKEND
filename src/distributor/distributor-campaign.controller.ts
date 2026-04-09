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
 * DistributorCampaignController — Distributor-facing campaign management.
 * All routes require JWT + RolesGuard(DISTRIBUTOR).
 */
@Controller({ path: 'distributor/campaigns', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DISTRIBUTOR')
export class DistributorCampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  /**
   * GET /api/v1/distributor/campaigns
   * List all campaigns for this distributor.
   */
  @Get()
  listCampaigns(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.campaignService.listCampaigns(user.sub, 'DISTRIBUTOR');
  }

  /**
   * POST /api/v1/distributor/campaigns
   * Create a new campaign.
   */
  @Post()
  createCampaign(@Req() req: Request, @Body() dto: CreateCampaignDto) {
    const user = req.user as JwtPayload;
    return this.campaignService.createCampaign(user.sub, 'DISTRIBUTOR', dto);
  }

  /**
   * GET /api/v1/distributor/campaigns/:uuid
   * Get campaign detail + analytics.
   * Declared after static routes to avoid route collision.
   */
  @Get(':uuid')
  getCampaign(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.campaignService.getCampaign(uuid, user.sub, 'DISTRIBUTOR');
  }

  /**
   * PATCH /api/v1/distributor/campaigns/:uuid
   * Update a campaign.
   */
  @Patch(':uuid')
  updateCampaign(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const user = req.user as JwtPayload;
    return this.campaignService.updateCampaign(uuid, user.sub, 'DISTRIBUTOR', dto);
  }

  /**
   * DELETE /api/v1/distributor/campaigns/:uuid
   * Delete a campaign.
   */
  @Delete(':uuid')
  deleteCampaign(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.campaignService.deleteCampaign(uuid, user.sub, 'DISTRIBUTOR');
  }
}
