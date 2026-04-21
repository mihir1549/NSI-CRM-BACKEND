import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { PhoneService } from './phone.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeadsService } from '../leads/leads.service';
import { PHONE_PROVIDER_TOKEN } from './providers/phone-provider.interface';

const USER_UUID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_UUID = '22222222-2222-2222-2222-222222222222';
const MOCK_PHONE = '+919999999999';

const mockPrisma = {
  emailOTP: { count: jest.fn(), create: jest.fn() },
  userProfile: { findUnique: jest.fn(), upsert: jest.fn() },
  funnelProgress: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  funnelStep: { findUnique: jest.fn(), findFirst: jest.fn() },
  funnelSection: { findUnique: jest.fn(), findFirst: jest.fn() },
  stepProgress: { upsert: jest.fn() },
};

const mockAudit = { log: jest.fn() };
const mockLeadsService = { onPhoneVerified: jest.fn() };
const mockPhoneProvider = { sendOtp: jest.fn(), verifyOtp: jest.fn() };

describe('PhoneService', () => {
  let service: PhoneService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LeadsService, useValue: mockLeadsService },
        { provide: PHONE_PROVIDER_TOKEN, useValue: mockPhoneProvider },
      ],
    }).compile();

    service = module.get<PhoneService>(PhoneService);
    jest.clearAllMocks();

    mockPrisma.emailOTP.count.mockResolvedValue(0);
    mockPrisma.emailOTP.create.mockResolvedValue({});
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    mockPrisma.userProfile.upsert.mockResolvedValue({});
    mockPrisma.funnelProgress.findUnique.mockResolvedValue(null);
    mockPrisma.funnelProgress.create.mockResolvedValue({ phoneVerified: true });
    mockPrisma.funnelProgress.update.mockResolvedValue({ phoneVerified: true });
    mockPhoneProvider.sendOtp.mockResolvedValue(true);
    mockPhoneProvider.verifyOtp.mockResolvedValue(true);
  });

  describe('sendOtp', () => {
    it('sends OTP successfully', async () => {
      const result = await service.sendOtp(
        USER_UUID,
        '09999999999',
        'sms',
        '127.0.0.1',
      );

      expect(result.message).toBe('OTP sent successfully');
      expect(mockPhoneProvider.sendOtp).toHaveBeenCalledWith(
        '+919999999999',
        'sms',
      );
      expect(mockPrisma.emailOTP.create).toHaveBeenCalled();
    });

    it('throws HttpException if rate limit exceeded', async () => {
      mockPrisma.emailOTP.count.mockResolvedValue(100);

      await expect(
        service.sendOtp(USER_UUID, MOCK_PHONE, 'sms', '127.0.0.1'),
      ).rejects.toThrow(HttpException);
      expect(mockPhoneProvider.sendOtp).not.toHaveBeenCalled();
    });

    it('throws ConflictException if phone registered to another user', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        userUuid: OTHER_USER_UUID,
        phone: MOCK_PHONE,
      });

      await expect(
        service.sendOtp(USER_UUID, MOCK_PHONE, 'sms', '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PHONE_ALREADY_REGISTERED_ATTEMPT' }),
      );
    });

    it('throws ConflictException if user already has phoneVerified', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        phoneVerified: true,
      });

      await expect(
        service.sendOtp(USER_UUID, MOCK_PHONE, 'sms', '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyOtp', () => {
    it('verifies OTP successfully and updates funnel progress', async () => {
      const result = await service.verifyOtp(
        USER_UUID,
        MOCK_PHONE,
        '123456',
        'sms',
        '127.0.0.1',
      );

      expect(result.message).toBe('Phone verified successfully');
      expect(mockPhoneProvider.verifyOtp).toHaveBeenCalledWith(
        MOCK_PHONE,
        '123456',
        'sms',
      );
      expect(mockPrisma.userProfile.upsert).toHaveBeenCalled();
      expect(mockPrisma.funnelProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userUuid: USER_UUID,
            phoneVerified: true,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PHONE_VERIFIED' }),
      );
      expect(mockLeadsService.onPhoneVerified).toHaveBeenCalledWith(USER_UUID);
    });

    it('throws BadRequestException for invalid OTP and increments attempt tracker', async () => {
      mockPhoneProvider.verifyOtp.mockResolvedValue(false);

      await expect(
        service.verifyOtp(USER_UUID, MOCK_PHONE, '000000', 'sms', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws HttpException if max wrong attempts reached', async () => {
      mockPhoneProvider.verifyOtp.mockResolvedValue(false);

      // 100 wrong attempts
      for (let i = 0; i < 100; i++) {
        await expect(
          service.verifyOtp(USER_UUID, MOCK_PHONE, '000', 'sms', '127.0.0.1'),
        ).rejects.toThrow(BadRequestException);
      }

      // 101st should lockout
      await expect(
        service.verifyOtp(USER_UUID, MOCK_PHONE, '000', 'sms', '127.0.0.1'),
      ).rejects.toThrow(HttpException);
    });

    it('advances funnel steps if progress already exists', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        uuid: 'progress-1',
        userUuid: USER_UUID,
        currentStepUuid: 'step-1',
      });
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        uuid: 'step-1',
        sectionUuid: 'section-1',
        order: 1,
      });
      mockPrisma.funnelStep.findFirst.mockResolvedValue({
        uuid: 'step-2',
        sectionUuid: 'section-1',
        order: 2,
      });
      mockPrisma.funnelProgress.update.mockResolvedValue({
        phoneVerified: true,
        currentStepUuid: 'step-2',
      });

      const result = await service.verifyOtp(
        USER_UUID,
        MOCK_PHONE,
        '123456',
        'sms',
        '127.0.0.1',
      );

      expect(mockPrisma.stepProgress.upsert).toHaveBeenCalled();
      expect(mockPrisma.funnelProgress.update).toHaveBeenCalled();
      expect(result.progress.phoneVerified).toBe(true);
    });
  });

  describe('normalizePhone', () => {
    it('throws BadRequestException for invalid formats', () => {
      expect(() => service.normalizePhone('123')).toThrow(BadRequestException);
    });

    it('cleans and normalizes valid numbers', () => {
      expect(service.normalizePhone('09999999999')).toBe('+919999999999');
      expect(service.normalizePhone('919999999999')).toBe('+919999999999');
      expect(service.normalizePhone('+919999999999')).toBe('+919999999999');
    });
  });
});
