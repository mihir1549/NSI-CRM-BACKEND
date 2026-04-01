import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

/**
 * @CurrentUser() decorator — extracts the JWT payload from the request.
 *
 * Usage:
 *   @CurrentUser() user: JwtPayload
 *   @CurrentUser('sub') userId: string
 *
 * NOTE: This returns the JWT payload (routing hint).
 * For authoritative user data, use request.dbUser (set by guards that fetch from DB).
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
