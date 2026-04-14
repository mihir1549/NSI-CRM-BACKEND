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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CampaignService } from '../campaign/campaign.service.js';
import { CreateCampaignDto } from '../campaign/dto/create-campaign.dto.js';
import { UpdateCampaignDto } from '../campaign/dto/update-campaign.dto.js';
import {
  CampaignItemResponse,
  CampaignDetailResponse,
  CampaignUpdateResponse,
} from '../campaign/dto/responses/campaign.responses.js';
import { ErrorResponse, MessageResponse } from '../common/dto/responses/error.response.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * DistributorCampaignController — Distributor-facing campaign management.
 * All routes require JWT + RolesGuard(DISTRIBUTOR).
 */
@ApiTags('Campaign')
@ApiBearerAuth('access-token')
@Controller({ path: 'distributor/campaigns', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DISTRIBUTOR')
export class DistributorCampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  /**
   * GET /api/v1/distributor/campaigns
   * List all campaigns for this distributor.
   */
  @ApiOperation({ summary: 'List campaigns for current distributor' })
  @ApiResponse({ status: 200, description: 'Campaigns list', type: [CampaignItemResponse] })
  @Get()
  listCampaigns(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.campaignService.listCampaigns(user.sub, 'DISTRIBUTOR');
  }

  /**
   * POST /api/v1/distributor/campaigns
   * Create a new campaign.
   */
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created', type: CampaignItemResponse })
  @ApiResponse({ status: 409, description: 'Campaign slug conflict', type: ErrorResponse })
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
  @ApiOperation({ summary: 'Get campaign detail and analytics' })
  @ApiParam({ name: 'uuid', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign detail', type: CampaignDetailResponse })
  @ApiResponse({ status: 404, description: 'Campaign not found', type: ErrorResponse })
  @Get(':uuid')
  getCampaign(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.campaignService.getCampaign(uuid, user.sub, 'DISTRIBUTOR');
  }

  /**
   * GET /api/v1/distributor/campaigns/:uuid/edit
   * Get campaign data for edit form.
   */
  @ApiOperation({ summary: 'Get campaign data for editing' })
  @ApiParam({ name: 'uuid', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign edit data', type: CampaignUpdateResponse })
  @ApiResponse({ status: 404, description: 'Campaign not found', type: ErrorResponse })
  @Get(':uuid/edit')
  getCampaignForUpdate(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.campaignService.getCampaignForUpdate(uuid, user.sub, 'DISTRIBUTOR');
  }

  /**
   * PATCH /api/v1/distributor/campaigns/:uuid
   * Update a campaign.
   */
  @ApiOperation({ summary: 'Update a campaign' })
  @ApiParam({ name: 'uuid', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign updated', type: CampaignItemResponse })
  @ApiResponse({ status: 404, description: 'Campaign not found', type: ErrorResponse })
  @ApiResponse({ status: 409, description: 'Campaign slug conflict', type: ErrorResponse })
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
  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiParam({ name: 'uuid', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign deleted', type: MessageResponse })
  @ApiResponse({ status: 404, description: 'Campaign not found', type: ErrorResponse })
  @Delete(':uuid')
  deleteCampaign(@Req() req: Request, @Param('uuid') uuid: string) {
    const user = req.user as JwtPayload;
    return this.campaignService.deleteCampaign(uuid, user.sub, 'DISTRIBUTOR');
  }
}
