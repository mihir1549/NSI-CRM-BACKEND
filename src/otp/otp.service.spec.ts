import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { PrismaService } from '../prisma/prisma.service';
import bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

// ─── Mock Prisma ────────────────────────────────────
const mockPrisma = {
  user: { findUnique: jest.fn() },
  emailOTP: {
    updateMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

describe('OtpService', () => {
  let service: OtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<OtpService>(OtpService);
    jest.clearAllMocks();

    // Reset the private resendTracker between tests
    (service as any).resendTracker = new Map();
  });

  // ─── generateOtp ──────────────────────────────────
  describe('generateOtp', () => {
    it('should return a 6-digit string', () => {
      const otp = service.generateOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should pad with leading zeros when needed', () => {
      // Run it multiple times to ensure format consistency
      for (let i = 0; i < 20; i++) {
        const otp = service.generateOtp();
        expect(otp).toHaveLength(6);
      }
    });
  });

  // ─── storeOtp ─────────────────────────────────────
  describe('storeOtp', () => {
    it('should mark old OTPs as used and create a new one', async () => {
      const user = { uuid: 'u1', email: 'test@test.com' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.updateMany.mockResolvedValue({ count: 1 });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-otp');
      mockPrisma.emailOTP.create.mockResolvedValue({});

      await service.storeOtp('Test@Test.com', '123456');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
      expect(mockPrisma.emailOTP.updateMany).toHaveBeenCalledWith({
        where: { userUuid: 'u1', used: false },
        data: { used: true },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 12);
      expect(mockPrisma.emailOTP.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userUuid: 'u1',
          otpHash: 'hashed-otp',
          attempts: 0,
        }),
      });
    });

    it('should do nothing if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.storeOtp('missing@test.com', '123456');

      expect(mockPrisma.emailOTP.create).not.toHaveBeenCalled();
    });
  });

  // ─── verifyOtp ────────────────────────────────────
  describe('verifyOtp', () => {
    const user = { uuid: 'u1', email: 'test@test.com' };
    const otpRecord = {
      uuid: 'otp1',
      otpHash: 'hash',
      attempts: 0,
      used: false,
    };

    it('should return valid:true and mark OTP as used on correct OTP', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.findFirst.mockResolvedValue(otpRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.emailOTP.update.mockResolvedValue({});

      const result = await service.verifyOtp('test@test.com', '123456');

      expect(result).toEqual({ valid: true });
      expect(mockPrisma.emailOTP.update).toHaveBeenCalledWith({
        where: { uuid: 'otp1' },
        data: { used: true },
      });
    });

    it('should return valid:false with remaining attempts on wrong OTP', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.findFirst.mockResolvedValue({
        ...otpRecord,
        attempts: 1,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockPrisma.emailOTP.update.mockResolvedValue({});

      const result = await service.verifyOtp('test@test.com', 'wrong');

      expect(result).toEqual({ valid: false, attemptsRemaining: 1 });
      expect(mockPrisma.emailOTP.update).toHaveBeenCalledWith({
        where: { uuid: 'otp1' },
        data: { attempts: 2 },
      });
    });

    it('should return valid:false with 0 remaining when max attempts reached', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.findFirst.mockResolvedValue({
        ...otpRecord,
        attempts: 3,
      });

      const result = await service.verifyOtp('test@test.com', '123456');

      expect(result).toEqual({ valid: false, attemptsRemaining: 0 });
    });

    it('should return valid:false when no OTP record found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.findFirst.mockResolvedValue(null);

      const result = await service.verifyOtp('test@test.com', '123456');

      expect(result).toEqual({ valid: false, attemptsRemaining: 0 });
    });

    it('should return valid:false when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.verifyOtp('missing@test.com', '123456');

      expect(result).toEqual({ valid: false, attemptsRemaining: 0 });
    });
  });

  // ─── deleteOtp ────────────────────────────────────
  describe('deleteOtp', () => {
    it('should mark all unused OTPs as used', async () => {
      const user = { uuid: 'u1' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.updateMany.mockResolvedValue({ count: 1 });

      await service.deleteOtp('test@test.com');

      expect(mockPrisma.emailOTP.updateMany).toHaveBeenCalledWith({
        where: { userUuid: 'u1', used: false },
        data: { used: true },
      });
    });

    it('should do nothing if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.deleteOtp('missing@test.com');

      expect(mockPrisma.emailOTP.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── checkResendLimit ─────────────────────────────
  describe('checkResendLimit', () => {
    it('should allow first 3 requests', async () => {
      expect(await service.checkResendLimit('test@test.com')).toBe(true);
      expect(await service.checkResendLimit('test@test.com')).toBe(true);
      expect(await service.checkResendLimit('test@test.com')).toBe(true);
    });

    it('should block the 4th request in the same window', async () => {
      await service.checkResendLimit('test@test.com');
      await service.checkResendLimit('test@test.com');
      await service.checkResendLimit('test@test.com');

      expect(await service.checkResendLimit('test@test.com')).toBe(false);
    });

    it('should reset after window expires', async () => {
      await service.checkResendLimit('test@test.com');
      await service.checkResendLimit('test@test.com');
      await service.checkResendLimit('test@test.com');

      // Manually expire the window
      const tracker = (service as any).resendTracker;
      const entry = tracker.get('test@test.com');
      entry.windowStart = Date.now() - 3601 * 1000; // Over 1 hour ago

      expect(await service.checkResendLimit('test@test.com')).toBe(true);
    });
  });

  // ─── isOtpBlocked ─────────────────────────────────
  describe('isOtpBlocked', () => {
    it('should return true when max attempts reached', async () => {
      const user = { uuid: 'u1' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.findFirst.mockResolvedValue({ attempts: 3 });

      expect(await service.isOtpBlocked('test@test.com')).toBe(true);
    });

    it('should return false when under limit', async () => {
      const user = { uuid: 'u1' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.findFirst.mockResolvedValue({ attempts: 1 });

      expect(await service.isOtpBlocked('test@test.com')).toBe(false);
    });

    it('should return false when no OTP record exists', async () => {
      const user = { uuid: 'u1' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.emailOTP.findFirst.mockResolvedValue(null);

      expect(await service.isOtpBlocked('test@test.com')).toBe(false);
    });

    it('should return false when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      expect(await service.isOtpBlocked('missing@test.com')).toBe(false);
    });
  });
});
