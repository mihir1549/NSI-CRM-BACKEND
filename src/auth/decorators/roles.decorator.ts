import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * @Roles() decorator — specifies which roles can access a route.
 * Used in conjunction with RolesGuard.
 *
 * Usage: @Roles('ADMIN', 'DISTRIBUTOR')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
