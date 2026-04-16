import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Req,
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
import { BroadcastService } from './broadcast.service.js';
import { CreateBroadcastDto } from './dto/create-broadcast.dto.js';
import {
  BroadcastListResponse,
  BroadcastMessageResponse,
  BroadcastDetailResponse,
} from './dto/responses/broadcast.responses.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('Broadcast Distributor')
@ApiBearerAuth('access-token')
@Controller({ path: 'distributor/broadcasts', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DISTRIBUTOR')
export class BroadcastDistributorController {
  constructor(private readonly broadcastService: BroadcastService) {}

  /**
   * POST /api/v1/distributor/broadcasts
   * Create a broadcast targeting the distributor's referred users.
   */
  @ApiOperation({
    summary: 'Distributor: create a broadcast for referred users',
  })
  @ApiResponse({
    status: 201,
    description: 'Broadcast created',
    type: BroadcastDetailResponse,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Post()
  async create(@Body() dto: CreateBroadcastDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.broadcastService.createDistributorBroadcast(dto, user.sub);
  }

  /**
   * GET /api/v1/distributor/broadcasts
   * Paginated list of this distributor's own broadcasts.
   */
  @ApiOperation({ summary: 'Distributor: list own broadcasts with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated broadcast list',
    type: BroadcastListResponse,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Get()
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.broadcastService.getDistributorBroadcasts(
      user.sub,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    );
  }

  /**
   * PATCH /api/v1/distributor/broadcasts/:uuid/deactivate
   * Deactivate one of this distributor's own broadcasts.
   */
  @ApiOperation({ summary: 'Distributor: deactivate own broadcast' })
  @ApiParam({ name: 'uuid', description: 'Broadcast UUID' })
  @ApiResponse({
    status: 200,
    description: 'Broadcast deactivated',
    type: BroadcastMessageResponse,
  })
  @ApiResponse({ status: 404, description: 'Broadcast not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — can only deactivate own broadcasts',
  })
  @Patch(':uuid/deactivate')
  async deactivate(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.broadcastService.deactivateBroadcast(
      uuid,
      user.sub,
      'DISTRIBUTOR',
    );
  }
}
