import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../users/users.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

/**
 * RolesGuard — checks user.role against the required roles from @Roles() decorator.
 *
 * CRITICAL: This guard ALWAYS re-fetches the user from the database.
 * The JWT role claim is a routing hint only — the DB record is the single source of truth.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // If no @Roles() decorator is applied, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const jwtPayload = request.user as JwtPayload;

    if (!jwtPayload?.sub) {
      throw new ForbiddenException('Access denied');
    }

    // ALWAYS fetch fresh user from DB — never trust JWT role claim
    const user = await this.usersService.findByUuid(jwtPayload.sub);

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn(
        `User ${user.uuid} with role ${user.role} denied access. Required: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    // Attach fresh user data to request for downstream use
    request.dbUser = user;
    return true;
  }
}
