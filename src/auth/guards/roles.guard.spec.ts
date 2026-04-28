import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus, UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard.js';
import { UsersService } from '../../users/users.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

const makeContext = (user: { sub: string } | null) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, dbUser: undefined }),
    }),
  }) as unknown as ExecutionContext;

const makeUser = (overrides: Partial<{ role: UserRole; status: UserStatus }> = {}) => ({
  uuid: 'user-uuid',
  role: UserRole.DISTRIBUTOR,
  status: UserStatus.ACTIVE,
  ...overrides,
});

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    usersService = { findByUuid: jest.fn() } as unknown as jest.Mocked<UsersService>;
    guard = new RolesGuard(reflector, usersService);
  });

  it('allows access when no @Roles() decorator is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext({ sub: 'user-uuid' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(usersService.findByUuid).not.toHaveBeenCalled();
  });

  it('allows access when @Roles([]) empty array', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const ctx = makeContext({ sub: 'user-uuid' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws ForbiddenException when no JWT payload', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.DISTRIBUTOR]);
    const ctx = makeContext(null);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user not found in DB', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.DISTRIBUTOR]);
    usersService.findByUuid.mockResolvedValue(null);
    const ctx = makeContext({ sub: 'user-uuid' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('User not found');
  });

  it('B1: throws ForbiddenException when user is SUSPENDED', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.DISTRIBUTOR]);
    usersService.findByUuid.mockResolvedValue(
      makeUser({ role: UserRole.DISTRIBUTOR, status: UserStatus.SUSPENDED }) as any,
    );
    const ctx = makeContext({ sub: 'user-uuid' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Your account has been suspended. Please contact support.',
    );
  });

  it('B1: suspended user is blocked even if role matches required role', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    usersService.findByUuid.mockResolvedValue(
      makeUser({ role: UserRole.ADMIN, status: UserStatus.SUSPENDED }) as any,
    );
    const ctx = makeContext({ sub: 'user-uuid' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when role does not match', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    usersService.findByUuid.mockResolvedValue(
      makeUser({ role: UserRole.CUSTOMER, status: UserStatus.ACTIVE }) as any,
    );
    const ctx = makeContext({ sub: 'user-uuid' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Insufficient permissions');
  });

  it('grants access and attaches dbUser when role matches and user is active', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.DISTRIBUTOR]);
    const user = makeUser({ role: UserRole.DISTRIBUTOR, status: UserStatus.ACTIVE });
    usersService.findByUuid.mockResolvedValue(user as any);
    const request = { user: { sub: 'user-uuid' }, dbUser: undefined };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(request.dbUser).toBe(user);
  });
});
