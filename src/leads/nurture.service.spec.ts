import { Test, TestingModule } from '@nestjs/testing';
import { NurtureService } from './nurture.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { NurtureStatus, LeadStatus } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const USER_UUID       = '11111111-1111-1111-1111-111111111111';
const LEAD_UUID       = '22222222-2222-2222-2222-222222222222';
const ENROLLMENT_UUID = '33333333-3333-3333-3333-333333333333';

const mockUser = { uuid: USER_UUID, email: 'user@test.com', fullName: 'Test User' };
const mockLead = { uuid: LEAD_UUID, status: LeadStatus.NURTURE };

const makeEnrollment = (overrides: Record<string, unknown> = {}) => ({
  uuid: ENROLLMENT_UUID,
  userUuid: USER_UUID,
  leadUuid: LEAD_UUID,
  day1SentAt: null,
  day3SentAt: null,
  day7SentAt: null,
  user: mockUser,
  lead: mockLead,
  ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPrisma = {
  nurtureEnrollment: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    update: jest.fn(),
  },
  leadActivity: {
    create: jest.fn(),
  },
};

const mockMail = {
  sendNurtureDay1: jest.fn(),
  sendNurtureDay3: jest.fn(),
  sendNurtureDay7: jest.fn(),
};

const mockAudit = { log: jest.fn() };

describe('NurtureService', () => {
  let service: NurtureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NurtureService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<NurtureService>(NurtureService);
    jest.resetAllMocks();

    mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([]);
    mockPrisma.nurtureEnrollment.update.mockResolvedValue({});
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.leadActivity.create.mockResolvedValue({});
  });

  // ══════════════════════════════════════════════════════════
  // processNurtureEmails()
  // ══════════════════════════════════════════════════════════
  describe('processNurtureEmails()', () => {
    it('returns early when no due enrollments', async () => {
      mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([]);

      await service.processNurtureEmails();

      expect(mockPrisma.nurtureEnrollment.update).not.toHaveBeenCalled();
      expect(mockMail.sendNurtureDay1).not.toHaveBeenCalled();
    });

    it('sends Day 1 email and updates nextEmailAt when day1SentAt is null', async () => {
      mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([makeEnrollment()]);

      await service.processNurtureEmails();

      expect(mockMail.sendNurtureDay1).toHaveBeenCalledWith(mockUser.email, mockUser.fullName);
      expect(mockPrisma.nurtureEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: ENROLLMENT_UUID },
          data: expect.objectContaining({ day1SentAt: expect.any(Date) }),
        }),
      );
      expect(mockMail.sendNurtureDay3).not.toHaveBeenCalled();
    });

    it('sends Day 3 email when day1SentAt is set but day3SentAt is null', async () => {
      mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([
        makeEnrollment({ day1SentAt: new Date('2026-04-01'), day3SentAt: null }),
      ]);

      await service.processNurtureEmails();

      expect(mockMail.sendNurtureDay3).toHaveBeenCalledWith(mockUser.email, mockUser.fullName);
      expect(mockPrisma.nurtureEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ day3SentAt: expect.any(Date) }),
        }),
      );
      expect(mockMail.sendNurtureDay1).not.toHaveBeenCalled();
    });

    it('sends Day 7 email, completes enrollment, sets lead to LOST, logs activity and audit', async () => {
      mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([
        makeEnrollment({
          day1SentAt: new Date('2026-04-01'),
          day3SentAt: new Date('2026-04-03'),
          day7SentAt: null,
        }),
      ]);

      await service.processNurtureEmails();

      expect(mockMail.sendNurtureDay7).toHaveBeenCalledWith(mockUser.email, mockUser.fullName);
      expect(mockPrisma.nurtureEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: NurtureStatus.COMPLETED, day7SentAt: expect.any(Date) }),
        }),
      );
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: LeadStatus.LOST } }),
      );
      expect(mockPrisma.leadActivity.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'NURTURE_SEQUENCE_COMPLETED' }),
      );
    });

    it('processes multiple enrollments in one run', async () => {
      const e1 = makeEnrollment();
      const e2 = {
        ...makeEnrollment({ day1SentAt: new Date('2026-04-01') }),
        uuid: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      };
      mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([e1, e2]);

      await service.processNurtureEmails();

      expect(mockMail.sendNurtureDay1).toHaveBeenCalledTimes(1);
      expect(mockMail.sendNurtureDay3).toHaveBeenCalledTimes(1);
    });

    it('continues processing remaining enrollments if one throws an error', async () => {
      const e1 = makeEnrollment();
      const e2 = {
        ...makeEnrollment({ day1SentAt: new Date('2026-04-01'), day3SentAt: null }),
        uuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      };
      mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([e1, e2]);
      mockPrisma.nurtureEnrollment.update
        .mockRejectedValueOnce(new Error('DB timeout'))
        .mockResolvedValue({});

      await expect(service.processNurtureEmails()).resolves.toBeUndefined();

      // Second enrollment's Day 3 email should still fire
      expect(mockMail.sendNurtureDay3).toHaveBeenCalled();
    });

    it('does not update lead when processing Day 1 email', async () => {
      mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([makeEnrollment()]);

      await service.processNurtureEmails();

      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it('does not update lead when processing Day 3 email', async () => {
      mockPrisma.nurtureEnrollment.findMany.mockResolvedValue([
        makeEnrollment({ day1SentAt: new Date('2026-04-01') }),
      ]);

      await service.processNurtureEmails();

      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });
  });
});
