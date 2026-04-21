import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Response, Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { SseAuthGuard } from './sse-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { SseService } from './sse.service.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('SSE')
@ApiBearerAuth('access-token')
@Controller({ path: 'sse', version: '1' })
export class SseController {
  constructor(private readonly sseService: SseService) {}

  /**
   * GET /api/v1/sse/stream
   * Establishes a persistent Server-Sent Events connection for real-time updates.
   */
  @ApiOperation({ summary: 'Establish a real-time SSE stream connection' })
  @Get('stream')
  @SkipThrottle()
  @UseGuards(SseAuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'DISTRIBUTOR', 'SUPER_ADMIN', 'ADMIN')
  stream(@Req() req: Request, @Res() res: Response) {
    const user = req.user as JwtPayload;
    const userUuid = user.sub;
    const role = user.role;

    // Set specific headers required for SSE to keep the connection open
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx/Proxy
    res.flushHeaders();

    // Send initial handshake event
    res.write('data: {"type":"connected"}\n\n');

    // Register active connection in the service
    this.sseService.addClient(userUuid, role, res);

    // Keep-alive ping interval to prevent connection timeouts (30 seconds)
    const pingInterval = setInterval(() => {
      res.write(':ping\n\n');
    }, 30000);

    // Clean up connection on client disconnect
    req.on('close', () => {
      clearInterval(pingInterval);
      this.sseService.removeClient(userUuid);
    });
  }
}
