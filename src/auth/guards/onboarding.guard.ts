import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service.js';
import { UserStatus } from '@prisma/client';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

/**
 * OnboardingGuard — blocks ALL protected routes when user.status === PROFILE_INCOMPLETE.
 * Only the /auth/complete-profile endpoint is allowed to pass through.
 *
 * CRITICAL: This guard ALWAYS re-fetches the user from the database.
 * The JWT status is a routing hint only — the DB record is the single source of truth.
 * Frontend CANNOT skip the country step by calling protected routes directly.
 */
@Injectable()
export class OnboardingGuard implements CanActivate {
  private readonly logger = new Logger(OnboardingGuard.name);

  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const jwtPayload = request.user as JwtPayload;

    if (!jwtPayload?.sub) {
      return true; // Let JwtAuthGuard handle unauthenticated requests
    }

    // Check if this is the complete-profile endpoint — always allow
    const url: string = request.url;
    if (url.includes('/auth/complete-profile')) {
      return true;
    }

    // ALWAYS fetch fresh user from DB — never trust JWT status claim
    const user = await this.usersService.findByUuid(jwtPayload.sub);

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (user.status === UserStatus.PROFILE_INCOMPLETE) {
      this.logger.debug(`User ${user.uuid} blocked — profile incomplete`);
      throw new ForbiddenException('Please complete your profile first');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended');
    }

    // Attach fresh user data to request for downstream use
    request.dbUser = user;
    return true;
  }
}
