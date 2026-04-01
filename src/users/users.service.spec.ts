import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

// ─── Mock Prisma ────────────────────────────────────
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ─── findByEmail ──────────────────────────────────
  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const user = { uuid: 'u1', email: 'test@test.com' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findByEmail('Test@Test.com');

      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('missing@test.com');

      expect(result).toBeNull();
    });
  });

  // ─── findByUuid ───────────────────────────────────
  describe('findByUuid', () => {
    it('should return user when found', async () => {
      const user = { uuid: 'u1' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findByUuid('u1');

      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { uuid: 'u1' },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      expect(await service.findByUuid('missing')).toBeNull();
    });
  });

  // ─── create ───────────────────────────────────────
  describe('create', () => {
    it('should create user with correct defaults', async () => {
      const input = { fullName: 'John', email: 'John@Test.com', passwordHash: 'hash123' };
      const created = { uuid: 'u1', ...input, email: 'john@test.com' };
      mockPrisma.user.create.mockResolvedValue(created);

      const result = await service.create(input);

      expect(result).toEqual(created);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          fullName: 'John',
          email: 'john@test.com',
          passwordHash: 'hash123',
          role: UserRole.USER,
          status: UserStatus.REGISTERED,
          emailVerified: false,
          country: null,
        },
      });
    });
  });

  // ─── updateEmailVerified ──────────────────────────
  describe('updateEmailVerified', () => {
    it('should set emailVerified and EMAIL_VERIFIED status', async () => {
      const updated = { uuid: 'u1', emailVerified: true, status: UserStatus.EMAIL_VERIFIED };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateEmailVerified('u1');

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { uuid: 'u1' },
        data: { emailVerified: true, status: UserStatus.EMAIL_VERIFIED },
      });
    });
  });

  // ─── updateStatus ─────────────────────────────────
  describe('updateStatus', () => {
    it('should update user status', async () => {
      const updated = { uuid: 'u1', status: UserStatus.ACTIVE };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateStatus('u1', UserStatus.ACTIVE);

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { uuid: 'u1' },
        data: { status: UserStatus.ACTIVE },
      });
    });
  });

  // ─── updateCountry ────────────────────────────────
  describe('updateCountry', () => {
    it('should set country and ACTIVE status', async () => {
      const updated = { uuid: 'u1', country: 'US', status: UserStatus.ACTIVE };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateCountry('u1', 'US');

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { uuid: 'u1' },
        data: { country: 'US', status: UserStatus.ACTIVE },
      });
    });
  });

  // ─── updatePassword ───────────────────────────────
  describe('updatePassword', () => {
    it('should update password hash', async () => {
      const updated = { uuid: 'u1', passwordHash: 'newHash' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updatePassword('u1', 'newHash');

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { uuid: 'u1' },
        data: { passwordHash: 'newHash' },
      });
    });
  });

  // ─── findByGoogleId ───────────────────────────────
  describe('findByGoogleId', () => {
    it('should find user by Google ID', async () => {
      const user = { uuid: 'u1', googleId: 'g123' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findByGoogleId('g123');

      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: 'g123' },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      expect(await service.findByGoogleId('missing')).toBeNull();
    });
  });

  // ─── mergeGoogleAccount ───────────────────────────
  describe('mergeGoogleAccount', () => {
    it('should merge Google account with existing user', async () => {
      const merged = { uuid: 'u1', googleId: 'g123', authProvider: 'GOOGLE' };
      mockPrisma.user.update.mockResolvedValue(merged);

      const result = await service.mergeGoogleAccount('u1', 'g123');

      expect(result).toEqual(merged);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { uuid: 'u1' },
        data: { googleId: 'g123', emailVerified: true, authProvider: 'GOOGLE' },
      });
    });
  });

  // ─── createGoogleUser ─────────────────────────────
  describe('createGoogleUser', () => {
    it('should create Google user with correct defaults', async () => {
      const input = { fullName: 'Jane', email: 'jane@gmail.com', googleId: 'g456' };
      const created = { uuid: 'u2', ...input };
      mockPrisma.user.create.mockResolvedValue(created);

      const result = await service.createGoogleUser(input);

      expect(result).toEqual(created);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Jane',
          email: 'jane@gmail.com',
          googleId: 'g456',
          passwordHash: null,
          authProvider: 'GOOGLE',
          emailVerified: true,
          role: UserRole.USER,
          status: UserStatus.EMAIL_VERIFIED,
          country: null,
        },
      });
    });
  });
});
