import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { BroadcastService } from './broadcast.service.js';
import {
  ActiveBroadcastsResponse,
  BroadcastMessageResponse,
  BroadcastDetailResponse,
} from './dto/responses/broadcast.responses.js';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

// IMPORTANT: route registration order matters.
// /active MUST be before /:uuid to prevent NestJS treating 'active' as a UUID param.
@ApiTags('Broadcasts')
@ApiBearerAuth('access-token')
@Controller({ path: 'broadcasts', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class BroadcastUserController {
  constructor(private readonly broadcastService: BroadcastService) {}

  /**
   * GET /api/v1/broadcasts/active
   * Returns all active announcements + unread broadcasts for the authenticated user.
   * Called on every page load. Route is registered BEFORE /:uuid.
   */
  @ApiOperation({
    summary: 'Get active announcements and broadcasts for current user',
    description:
      'Returns sticky announcements (always shown) and personal broadcasts (dismissable). ' +
      'unreadCount reflects only broadcast messages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active broadcasts and announcements',
    type: ActiveBroadcastsResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Roles('USER', 'CUSTOMER', 'DISTRIBUTOR', 'SUPER_ADMIN')
  @SkipThrottle()
  @Get('active')
  async getActive(@Req() req: Request) {
    const jwtUser = req.user as JwtPayload;
    const dbUser = (req as any).dbUser as
      | { uuid: string; role: string }
      | undefined;
    const role = dbUser?.role ?? 'USER';
    return this.broadcastService.getActiveBroadcastsForUser(jwtUser.sub, role);
  }

  /**
   * POST /api/v1/broadcasts/:uuid/dismiss
   * Dismiss (mark as read) a broadcast. Announcements cannot be dismissed.
   */
  @ApiOperation({ summary: 'Dismiss a broadcast message' })
  @ApiParam({ name: 'uuid', description: 'Broadcast UUID' })
  @ApiResponse({
    status: 200,
    description: 'Broadcast dismissed',
    type: BroadcastMessageResponse,
  })
  @ApiResponse({ status: 400, description: 'Cannot dismiss announcements' })
  @ApiResponse({ status: 404, description: 'Broadcast not found' })
  @Roles('USER', 'CUSTOMER', 'DISTRIBUTOR', 'SUPER_ADMIN')
  @Post(':uuid/dismiss')
  async dismiss(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.broadcastService.dismissBroadcast(uuid, user.sub);
  }

  /**
   * GET /api/v1/broadcasts/:uuid
   * Get full detail of a specific broadcast. Auto-marks BROADCAST as read.
   */
  @ApiOperation({ summary: 'Get full broadcast detail (auto-marks as read)' })
  @ApiParam({ name: 'uuid', description: 'Broadcast UUID' })
  @ApiResponse({
    status: 200,
    description: 'Broadcast detail',
    type: BroadcastDetailResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Broadcast not found or not visible to user',
  })
  @Roles('USER', 'CUSTOMER', 'DISTRIBUTOR', 'SUPER_ADMIN')
  @Get(':uuid')
  async getDetail(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Req() req: Request,
  ) {
    const jwtUser = req.user as JwtPayload;
    const dbUser = (req as any).dbUser as
      | { uuid: string; role: string }
      | undefined;
    const role = dbUser?.role ?? 'USER';
    return this.broadcastService.getBroadcastDetail(uuid, jwtUser.sub, role);
  }
}
