import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { OtpService } from '../otp/otp.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus, AuthProvider } from '@prisma/client';
import { TrackingService } from '../tracking/tracking.service';
import { LeadsService } from '../leads/leads.service';
import { CloudinaryAvatarService } from '../common/cloudinary/cloudinary-avatar.service';

// ─── Mock bcrypt ────────────────────────────────────
jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn().mockResolvedValue('hashed-value'),
    compare: jest.fn(),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-refresh-token-uuid'),
}));

// ─── Mock factories ─────────────────────────────────
const mockUsersService = {
  findByEmail: jest.fn(),
  findByUuid: jest.fn(),
  findByGoogleId: jest.fn(),
  create: jest.fn(),
  updateEmailVerified: jest.fn(),
  updateStatus: jest.fn(),
  updateCountry: jest.fn(),
  updatePassword: jest.fn(),
  mergeGoogleAccount: jest.fn(),
  createGoogleUser: jest.fn(),
};

const mockOtpService = {
  generateOtp: jest.fn().mockReturnValue('123456'),
  storeOtp: jest.fn(),
  verifyOtp: jest.fn(),
  deleteOtp: jest.fn(),
  checkResendLimit: jest.fn(),
  isOtpBlocked: jest.fn(),
};

const mockMailService = {
  sendOTP: jest.fn(),
  sendWelcome: jest.fn(),
  sendPasswordResetOTP: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

const mockPrisma = {
  authSession: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      REFRESH_TOKEN_EXPIRES_IN: '7d',
      JWT_EXPIRES_IN: '15m',
      JWT_SECRET: 'test-secret',
    };
    return config[key] || defaultValue;
  }),
};

// ─── Reusable test user ─────────────────────────────
const testUser = {
  uuid: 'user-uuid-1',
  fullName: 'Test User',
  email: 'test@test.com',
  passwordHash: 'hashed-password',
  role: 'USER',
  status: UserStatus.ACTIVE,
  country: 'US',
  emailVerified: true,
  authProvider: AuthProvider.EMAIL,
  googleId: null,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: MailService, useValue: mockMailService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: TrackingService,
          useValue: {
            attachToUser: jest.fn(),
            captureFromReferral: jest.fn(),
            capture: jest.fn(),
          }
        },
        {
          provide: LeadsService,
          useValue: {
            createLeadForUser: jest.fn(),
            createLead: jest.fn(),
            updateLeadStatus: jest.fn(),
          }
        },
        {
          provide: CloudinaryAvatarService,
          useValue: {
            uploadAvatar: jest.fn(),
          }
        }
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    // Re-apply default mocks after clearAllMocks
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-value');
    mockOtpService.generateOtp.mockReturnValue('123456');
    mockJwtService.sign.mockReturnValue('mock-access-token');
    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        REFRESH_TOKEN_EXPIRES_IN: '7d',
        JWT_EXPIRES_IN: '15m',
        JWT_SECRET: 'test-secret',
      };
      return config[key] || defaultValue;
    });
    mockPrisma.authSession.create.mockResolvedValue({});
  });

  // ═══════════════════════════════════════════════════
  // SIGNUP
  // ═══════════════════════════════════════════════════
  describe('signup', () => {
    it('should register a new user successfully', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(testUser);
      mockOtpService.storeOtp.mockResolvedValue(undefined);

      const result = await service.signup('Test User', 'Test@Test.com', 'Password123!', '127.0.0.1');

      expect(result.message).toContain('Registration successful');
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('test@test.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(mockUsersService.create).toHaveBeenCalled();
      expect(mockOtpService.generateOtp).toHaveBeenCalled();
      expect(mockOtpService.storeOtp).toHaveBeenCalledWith('test@test.com', '123456');
      expect(mockMailService.sendOTP).toHaveBeenCalledWith('test@test.com', 'Test User', '123456');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_SIGNUP' }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(testUser);

      await expect(
        service.signup('Test', 'test@test.com', 'Pass123!', '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ═══════════════════════════════════════════════════
  // VERIFY EMAIL OTP
  // ═══════════════════════════════════════════════════
  describe('verifyEmailOtp', () => {
    const unverifiedUser = { ...testUser, status: UserStatus.REGISTERED, country: null };

    it('should verify OTP and auto-login successfully', async () => {
      mockUsersService.findByEmail.mockResolvedValue(unverifiedUser);
      mockOtpService.isOtpBlocked.mockResolvedValue(false);
      mockOtpService.verifyOtp.mockResolvedValue({ valid: true });
      mockUsersService.updateEmailVerified.mockResolvedValue({ ...unverifiedUser, status: UserStatus.EMAIL_VERIFIED });
      const profileIncompleteUser = { ...unverifiedUser, status: UserStatus.PROFILE_INCOMPLETE };
      mockUsersService.findByUuid.mockResolvedValue({ ...unverifiedUser, status: UserStatus.EMAIL_VERIFIED, country: null });
      mockUsersService.updateStatus.mockResolvedValue(profileIncompleteUser);

      const result = await service.verifyEmailOtp('test@test.com', '123456', '127.0.0.1', 'TestAgent', {} as any);

      expect(result.accessToken).toBeDefined();
      expect(result.needsCountry).toBe(true);
      expect(result.user.status).toBe(UserStatus.PROFILE_INCOMPLETE);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EMAIL_VERIFIED' }),
      );
    });

    it('should throw if email not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.verifyEmailOtp('missing@test.com', '123456', '127.0.0.1', 'TestAgent', {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if OTP is blocked', async () => {
      mockUsersService.findByEmail.mockResolvedValue(unverifiedUser);
      mockOtpService.isOtpBlocked.mockResolvedValue(true);

      await expect(
        service.verifyEmailOtp('test@test.com', '123456', '127.0.0.1', 'TestAgent', {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if OTP is invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(unverifiedUser);
      mockOtpService.isOtpBlocked.mockResolvedValue(false);
      mockOtpService.verifyOtp.mockResolvedValue({ valid: false, attemptsRemaining: 2 });

      await expect(
        service.verifyEmailOtp('test@test.com', 'wrong', '127.0.0.1', 'TestAgent', {} as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════
  // COMPLETE PROFILE
  // ═══════════════════════════════════════════════════
  describe('completeProfile', () => {
    it('should complete profile successfully', async () => {
      const incompleteUser = { ...testUser, status: UserStatus.PROFILE_INCOMPLETE, country: null };
      mockUsersService.findByUuid.mockResolvedValue(incompleteUser);
      mockUsersService.updateCountry.mockResolvedValue({ ...incompleteUser, country: 'US', status: UserStatus.ACTIVE });

      const result = await service.completeProfile('user-uuid-1', 'US', '127.0.0.1');

      expect(result.message).toContain('Profile completed');
      expect(mockUsersService.updateCountry).toHaveBeenCalledWith('user-uuid-1', 'US');
      expect(mockMailService.sendWelcome).toHaveBeenCalled();
    });

    it('should throw if invalid country code', async () => {
      await expect(
        service.completeProfile('user-uuid-1', 'INVALID', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user not found', async () => {
      mockUsersService.findByUuid.mockResolvedValue(null);

      await expect(
        service.completeProfile('missing', 'US', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if profile already completed (ACTIVE user)', async () => {
      mockUsersService.findByUuid.mockResolvedValue(testUser); // status: ACTIVE

      await expect(
        service.completeProfile('user-uuid-1', 'US', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════
  describe('login', () => {
    it('should login successfully', async () => {
      mockUsersService.findByEmail.mockResolvedValue(testUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@test.com', 'Password123!', '127.0.0.1', 'TestAgent');

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('test@test.com');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_LOGIN' }),
      );
    });

    it('should throw if email not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('missing@test.com', 'pass', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user is REGISTERED (unverified)', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ ...testUser, status: UserStatus.REGISTERED });

      await expect(
        service.login('test@test.com', 'pass', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user is SUSPENDED', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ ...testUser, status: UserStatus.SUSPENDED });

      await expect(
        service.login('test@test.com', 'pass', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if Google user with no password', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        ...testUser,
        authProvider: AuthProvider.GOOGLE,
        passwordHash: null,
      });

      await expect(
        service.login('test@test.com', 'pass', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if password is wrong', async () => {
      mockUsersService.findByEmail.mockResolvedValue(testUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('test@test.com', 'wrongpass', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ═══════════════════════════════════════════════════
  // RESEND OTP
  // ═══════════════════════════════════════════════════
  describe('resendOtp', () => {
    it('should resend OTP successfully', async () => {
      const registeredUser = { ...testUser, status: UserStatus.REGISTERED };
      mockOtpService.checkResendLimit.mockResolvedValue(true);
      mockUsersService.findByEmail.mockResolvedValue(registeredUser);
      mockOtpService.deleteOtp.mockResolvedValue(undefined);
      mockOtpService.storeOtp.mockResolvedValue(undefined);

      const result = await service.resendOtp('test@test.com', '127.0.0.1');

      expect(result.message).toContain('New OTP sent');
      expect(mockOtpService.deleteOtp).toHaveBeenCalled();
      expect(mockMailService.sendOTP).toHaveBeenCalled();
    });

    it('should throw if rate limited', async () => {
      mockOtpService.checkResendLimit.mockResolvedValue(false);

      await expect(
        service.resendOtp('test@test.com', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return generic message if email not found (prevents enumeration)', async () => {
      mockOtpService.checkResendLimit.mockResolvedValue(true);
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.resendOtp('missing@test.com', '127.0.0.1');

      expect(result.message).toContain('If your email is registered');
      expect(mockOtpService.storeOtp).not.toHaveBeenCalled();
    });

    it('should return generic message if user is not REGISTERED', async () => {
      mockOtpService.checkResendLimit.mockResolvedValue(true);
      mockUsersService.findByEmail.mockResolvedValue(testUser); // status: ACTIVE

      const result = await service.resendOtp('test@test.com', '127.0.0.1');

      expect(result.message).toContain('If your email is registered');
    });
  });

  // ═══════════════════════════════════════════════════
  // REFRESH TOKEN
  // ═══════════════════════════════════════════════════
  describe('refreshToken', () => {
    const mockSession = {
      uuid: 'session-1',
      tokenId: 'mock-refresh-tok',
      refreshTokenHash: 'hashed-rt',
      userUuid: 'user-uuid-1',
    };

    it('should refresh tokens successfully', async () => {
      mockPrisma.authSession.findFirst.mockResolvedValue(mockSession);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersService.findByUuid.mockResolvedValue(testUser);
      mockPrisma.authSession.delete.mockResolvedValue({});

      const result = await service.refreshToken('mock-refresh-token-value', '127.0.0.1', 'TestAgent');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.authSession.delete).toHaveBeenCalledWith({
        where: { uuid: 'session-1' },
      });
    });

    it('should throw if no token provided', async () => {
      await expect(
        service.refreshToken('', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if session not found', async () => {
      mockPrisma.authSession.findFirst.mockResolvedValue(null);

      await expect(
        service.refreshToken('some-expired-token', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if token hash does not match', async () => {
      mockPrisma.authSession.findFirst.mockResolvedValue(mockSession);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshToken('wrong-token-value', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw and delete sessions if user is SUSPENDED', async () => {
      mockPrisma.authSession.findFirst.mockResolvedValue(mockSession);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersService.findByUuid.mockResolvedValue({ ...testUser, status: UserStatus.SUSPENDED });
      mockPrisma.authSession.deleteMany.mockResolvedValue({ count: 3 });

      await expect(
        service.refreshToken('mock-refresh-token-value', '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: { userUuid: 'user-uuid-1' },
      });
    });
  });

  // ═══════════════════════════════════════════════════
  // SET PASSWORD
  // ═══════════════════════════════════════════════════
  describe('setPassword', () => {
    it('should set password for Google user (no existing password)', async () => {
      const googleUser = { ...testUser, passwordHash: null, authProvider: AuthProvider.GOOGLE };
      mockUsersService.findByUuid.mockResolvedValue(googleUser);
      mockUsersService.updatePassword.mockResolvedValue({});

      const result = await service.setPassword('user-uuid-1', 'NewPass123!', '127.0.0.1');

      expect(result.message).toContain('Password set successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123!', 12);
      expect(mockUsersService.updatePassword).toHaveBeenCalled();
    });

    it('should throw if user already has a password', async () => {
      mockUsersService.findByUuid.mockResolvedValue(testUser); // has passwordHash

      await expect(
        service.setPassword('user-uuid-1', 'NewPass123!', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user not found', async () => {
      mockUsersService.findByUuid.mockResolvedValue(null);

      await expect(
        service.setPassword('missing', 'NewPass123!', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ═══════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════════
  describe('forgotPassword', () => {
    it('should send reset OTP successfully', async () => {
      mockOtpService.checkResendLimit.mockResolvedValue(true);
      mockUsersService.findByEmail.mockResolvedValue(testUser);
      mockOtpService.deleteOtp.mockResolvedValue(undefined);
      mockOtpService.storeOtp.mockResolvedValue(undefined);

      const result = await service.forgotPassword('test@test.com', '127.0.0.1');

      expect(result.message).toContain('password reset OTP');
      expect(mockMailService.sendPasswordResetOTP).toHaveBeenCalled();
    });

    it('should throw if rate limited', async () => {
      mockOtpService.checkResendLimit.mockResolvedValue(false);

      await expect(
        service.forgotPassword('test@test.com', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return generic message if email not found', async () => {
      mockOtpService.checkResendLimit.mockResolvedValue(true);
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('missing@test.com', '127.0.0.1');

      expect(result.message).toContain('If your email is registered');
    });

    it('should return generic message for REGISTERED (unverified) users', async () => {
      mockOtpService.checkResendLimit.mockResolvedValue(true);
      mockUsersService.findByEmail.mockResolvedValue({ ...testUser, status: UserStatus.REGISTERED });

      const result = await service.forgotPassword('test@test.com', '127.0.0.1');

      expect(result.message).toContain('If your email is registered');
    });
  });

  // ═══════════════════════════════════════════════════
  // RESET PASSWORD
  // ═══════════════════════════════════════════════════
  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockUsersService.findByEmail.mockResolvedValue(testUser);
      mockOtpService.isOtpBlocked.mockResolvedValue(false);
      mockOtpService.verifyOtp.mockResolvedValue({ valid: true });
      mockUsersService.updatePassword.mockResolvedValue({});
      mockPrisma.authSession.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.resetPassword('test@test.com', '123456', 'NewPass123!', '127.0.0.1');

      expect(result.message).toContain('Password has been safely reset');
      expect(mockUsersService.updatePassword).toHaveBeenCalled();
      // All sessions should be invalidated
      expect(mockPrisma.authSession.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userUuid: 'user-uuid-1' } }),
      );
    });

    it('should throw if email not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.resetPassword('missing@test.com', '123456', 'NewPass', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if OTP is blocked', async () => {
      mockUsersService.findByEmail.mockResolvedValue(testUser);
      mockOtpService.isOtpBlocked.mockResolvedValue(true);

      await expect(
        service.resetPassword('test@test.com', '123456', 'NewPass', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if OTP is invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(testUser);
      mockOtpService.isOtpBlocked.mockResolvedValue(false);
      mockOtpService.verifyOtp.mockResolvedValue({ valid: false, attemptsRemaining: 1 });

      await expect(
        service.resetPassword('test@test.com', 'wrong', 'NewPass', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════
  // GOOGLE LOGIN
  // ═══════════════════════════════════════════════════
  describe('handleGoogleLogin', () => {
    it('should login returning Google user', async () => {
      const googleUser = { ...testUser, googleId: 'g123', authProvider: AuthProvider.GOOGLE };
      mockUsersService.findByGoogleId.mockResolvedValue(googleUser);

      const result = await service.handleGoogleLogin('g123', 'test@test.com', 'Test', '127.0.0.1', 'Agent');

      expect(result.accessToken).toBeDefined();
      expect(result.user.uuid).toBe('user-uuid-1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GOOGLE_LOGIN_RETURNING' }),
      );
    });

    it('should merge with existing email account', async () => {
      mockUsersService.findByGoogleId.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue(testUser);
      const mergedUser = { ...testUser, googleId: 'g123', authProvider: AuthProvider.GOOGLE };
      mockUsersService.mergeGoogleAccount.mockResolvedValue(mergedUser);

      const result = await service.handleGoogleLogin('g123', 'test@test.com', 'Test', '127.0.0.1', 'Agent');

      expect(result.accessToken).toBeDefined();
      expect(mockUsersService.mergeGoogleAccount).toHaveBeenCalledWith('user-uuid-1', 'g123', undefined);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GOOGLE_LOGIN_MERGE' }),
      );
    });

    it('should create brand new Google user', async () => {
      mockUsersService.findByGoogleId.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue(null);
      const newGoogleUser = { ...testUser, googleId: 'g789', country: null, status: UserStatus.EMAIL_VERIFIED };
      mockUsersService.createGoogleUser.mockResolvedValue(newGoogleUser);
      const profileIncompleteUser = { ...newGoogleUser, status: UserStatus.PROFILE_INCOMPLETE };
      mockUsersService.updateStatus.mockResolvedValue(profileIncompleteUser);

      const result = await service.handleGoogleLogin('g789', 'new@gmail.com', 'New User', '127.0.0.1', 'Agent');

      expect(result.accessToken).toBeDefined();
      expect(result.needsCountry).toBe(true);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GOOGLE_LOGIN_NEW' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════
  describe('logout', () => {
    it('should delete session and return success', async () => {
      const session = { uuid: 's1', refreshTokenHash: 'hash' };
      mockPrisma.authSession.findFirst.mockResolvedValue(session);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.authSession.delete.mockResolvedValue({});

      const result = await service.logout('some-refresh-token', 'user-uuid-1', '127.0.0.1');

      expect(result.message).toContain('Logged out successfully');
      expect(mockPrisma.authSession.delete).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_LOGOUT' }),
      );
    });

    it('should succeed even without refresh token', async () => {
      const result = await service.logout(undefined, 'user-uuid-1', '127.0.0.1');

      expect(result.message).toContain('Logged out successfully');
      expect(mockPrisma.authSession.findFirst).not.toHaveBeenCalled();
    });

    it('should succeed even without user UUID (no audit log)', async () => {
      const result = await service.logout(undefined, undefined, '127.0.0.1');

      expect(result.message).toContain('Logged out successfully');
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });
});
