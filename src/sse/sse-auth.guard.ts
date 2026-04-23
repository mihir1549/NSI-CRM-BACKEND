import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { AuthService } from '../auth/auth.service.js';

/**
 * Auth guard for the SSE endpoint.
 * Browser EventSource cannot set custom headers, so this guard accepts
 * the JWT from either the Authorization Bearer header or a `token` query param.
 *
 * Check order:
 *   1. Authorization: Bearer <token>
 *   2. ?token=<accessToken>
 */
@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Check for ticket (new secure mechanism)
    const ticket = request.query['ticket'];
    if (typeof ticket === 'string' && ticket.length > 0) {
      const result = await this.authService.redeemSSETicket(ticket);
      if (!result) {
        throw new UnauthorizedException('Invalid or expired SSE ticket');
      }
      request.user = { sub: result.userUuid, role: result.role } as JwtPayload;
      return true;
    }

    // 2. Fallback to JWT mechanisms (backward compatibility)
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException(
        'No authentication ticket or token provided',
      );
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    const queryToken = request.query['token'];
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }

    return undefined;
  }
}
