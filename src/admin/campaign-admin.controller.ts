import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
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
import {
  ErrorResponse,
  MessageResponse,
} from '../common/dto/responses/error.response.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

/**
 * CampaignAdminController — Super Admin campaign management.
 * All routes require JWT + RolesGuard(SUPER_ADMIN).
 * Admin can see and manage ALL campaigns across all owners.
 */
@ApiTags('Campaign')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/campaigns', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CampaignAdminController {
  constructor(private readonly campaignService: CampaignService) {}

  /**
   * GET /api/v1/admin/campaigns
   * List all campaigns across all owners.
   */
  @ApiOperation({ summary: 'Admin: list all campaigns across all owners' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated campaigns list',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/CampaignItemResponse' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @Get()
  listCampaigns(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user as JwtPayload;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.campaignService.listCampaigns(
      user.sub,
      'ADMIN',
      pageNum,
      limitNum,
    );
  }

  /**
   * POST /api/v1/admin/campaigns
   * Create a new admin-owned campaign.
   */
  @ApiOperation({ summary: 'Admin: create a new campaign' })
  @ApiResponse({
    status: 201,
    description: 'Campaign created',
    type: CampaignItemResponse,
  })
  @ApiResponse({
    status: 409,
    description: 'Campaign slug conflict',
    type: ErrorResponse,
  })
  @Post()
  createCampaign(@Req() req: Request, @Body() dto: CreateCampaignDto) {
    const user = req.user as JwtPayload;
    return this.campaignService.createCampaign(user.sub, 'ADMIN', dto);
  }

  /**
   * GET /api/v1/admin/campaigns/:uuid
   * Get campaign detail + analytics.
   */
  @ApiOperation({ summary: 'Admin: get campaign detail and analytics' })
  @ApiParam({ name: 'uuid', description: 'Campaign UUID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign detail',
    type: CampaignDetailResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
    type: ErrorResponse,
  })
  @Get(':uuid')
  getCampaign(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    return this.campaignService.getCampaign(uuid, user.sub, 'ADMIN');
  }

  /**
   * GET /api/v1/admin/campaigns/:uuid/edit
   * Get campaign data for edit form.
   */
  @ApiOperation({ summary: 'Admin: get campaign data for editing' })
  @ApiParam({ name: 'uuid', description: 'Campaign UUID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign edit data',
    type: CampaignUpdateResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
    type: ErrorResponse,
  })
  @Get(':uuid/edit')
  getCampaignForUpdate(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    return this.campaignService.getCampaignForUpdate(uuid, user.sub, 'ADMIN');
  }

  /**
   * PATCH /api/v1/admin/campaigns/:uuid
   * Update any campaign.
   */
  @ApiOperation({ summary: 'Admin: update any campaign' })
  @ApiParam({ name: 'uuid', description: 'Campaign UUID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign updated',
    type: CampaignItemResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 409,
    description: 'Campaign slug conflict',
    type: ErrorResponse,
  })
  @Patch(':uuid')
  updateCampaign(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const user = req.user as JwtPayload;
    return this.campaignService.updateCampaign(uuid, user.sub, 'ADMIN', dto);
  }

  /**
   * DELETE /api/v1/admin/campaigns/:uuid
   * Delete any campaign.
   */
  @ApiOperation({ summary: 'Admin: delete any campaign' })
  @ApiParam({ name: 'uuid', description: 'Campaign UUID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign deleted',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
    type: ErrorResponse,
  })
  @Delete(':uuid')
  deleteCampaign(
    @Req() req: Request,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    const user = req.user as JwtPayload;
    return this.campaignService.deleteCampaign(uuid, user.sub, 'ADMIN');
  }
}
