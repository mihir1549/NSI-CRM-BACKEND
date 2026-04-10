import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeadStatus, LeadAction, UserRole } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const LEAD_UUID       = '11111111-1111-1111-1111-111111111111';
const USER_UUID       = '22222222-2222-2222-2222-222222222222';
const DISTRIBUTOR_UUID = '33333333-3333-3333-3333-333333333333';
const ADMIN_UUID      = '44444444-4444-4444-4444-444444444444';

const mockLead = {
  uuid: LEAD_UUID,
  userUuid: USER_UUID,
  assignedToUuid: DISTRIBUTOR_UUID,
  distributorUuid: DISTRIBUTOR_UUID,
  status: LeadStatus.HOT,
  phone: '9999999999',
};

const mockLeadAdmin = { ...mockLead, assignedToUuid: ADMIN_UUID, distributorUuid: null };

const mockLeadFull = {
  ...mockLead,
  user: { uuid: USER_UUID, fullName: 'Test User', email: 'test@test.com', country: 'IN', avatarUrl: null },
  activities: [],
  nurtureEnrollment: null,
};

const mockUpdatedLead = {
  uuid: LEAD_UUID,
  status: LeadStatus.CONTACTED,
  user: { uuid: USER_UUID, fullName: 'Test User', email: 'test@test.com', country: 'IN', avatarUrl: null },
  assignedTo: { uuid: DISTRIBUTOR_UUID, fullName: 'Distributor' },
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  lead: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  userAcquisition: {
    findUnique: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
  },
  leadActivity: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  nurtureEnrollment: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  funnelStep: {
    count: jest.fn(),
  },
  funnelProgress: {
    findUnique: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('LeadsService', () => {
  let service: LeadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    jest.clearAllMocks();

    // Safe defaults
    mockPrisma.lead.findMany.mockResolvedValue([]);
    mockPrisma.lead.count.mockResolvedValue(0);
    mockPrisma.lead.create.mockResolvedValue({});
    mockPrisma.lead.update.mockResolvedValue(mockUpdatedLead);
    mockPrisma.leadActivity.create.mockResolvedValue({});
    mockPrisma.leadActivity.findMany.mockResolvedValue([]);
    mockPrisma.funnelStep.count.mockResolvedValue(5);
    mockPrisma.funnelProgress.findUnique.mockResolvedValue(null);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.nurtureEnrollment.findUnique.mockResolvedValue(null);
    mockPrisma.nurtureEnrollment.create.mockResolvedValue({});
    mockPrisma.userAcquisition.findUnique.mockResolvedValue(null);
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue({ uuid: ADMIN_UUID });
    mockPrisma.user.update.mockResolvedValue({});
  });

  // ══════════════════════════════════════════════════════════
  // createLeadForUser() — fire-and-forget, never throws
  // ══════════════════════════════════════════════════════════
  describe('createLeadForUser()', () => {
    it('creates lead when none exists (direct — no distributor, SUPER_ADMIN found)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);
      mockPrisma.userAcquisition.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: ADMIN_UUID });

      await service.createLeadForUser(USER_UUID);

      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userUuid: USER_UUID, assignedToUuid: ADMIN_UUID, status: LeadStatus.NEW }),
        }),
      );
    });

    it('skips creation if lead already exists (idempotent)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead);

      await service.createLeadForUser(USER_UUID);

      expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });

    it('assigns lead to distributor when acquisition has distributorUuid', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);
      mockPrisma.userAcquisition.findUnique.mockResolvedValue({ distributorUuid: DISTRIBUTOR_UUID });

      await service.createLeadForUser(USER_UUID);

      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedToUuid: DISTRIBUTOR_UUID }),
        }),
      );
    });

    it('skips creation silently if no SUPER_ADMIN and no distributor', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);
      mockPrisma.userAcquisition.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.createLeadForUser(USER_UUID)).resolves.toBeUndefined();
      expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // onPhoneVerified() — fire-and-forget, never throws
  // ══════════════════════════════════════════════════════════
  describe('onPhoneVerified()', () => {
    it('updates lead phone and status to WARM after phone verified', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ ...mockLead, status: LeadStatus.NEW });
      mockPrisma.userProfile.findUnique.mockResolvedValue({ phone: '+919999999999' });

      await service.onPhoneVerified(USER_UUID);

      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: LEAD_UUID },
          data: { phone: '+919999999999', status: LeadStatus.WARM },
        }),
      );
      expect(mockPrisma.leadActivity.create).toHaveBeenCalled();
    });

    it('skips if lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.onPhoneVerified(USER_UUID)).resolves.toBeUndefined();
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it('skips if profile has no phone', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
      mockPrisma.userProfile.findUnique.mockResolvedValue({ phone: null });

      await expect(service.onPhoneVerified(USER_UUID)).resolves.toBeUndefined();
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // onDecisionYes() — fire-and-forget
  // ══════════════════════════════════════════════════════════
  describe('onDecisionYes()', () => {
    it('sets lead status to HOT', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ ...mockLead, status: LeadStatus.WARM });

      await service.onDecisionYes(USER_UUID);

      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: LeadStatus.HOT } }),
      );
      expect(mockPrisma.leadActivity.create).toHaveBeenCalled();
    });

    it('skips if lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.onDecisionYes(USER_UUID)).resolves.toBeUndefined();
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // onDecisionNo() — fire-and-forget
  // ══════════════════════════════════════════════════════════
  describe('onDecisionNo()', () => {
    it('sets lead status to NURTURE and creates nurture enrollment', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ ...mockLead, status: LeadStatus.HOT });

      await service.onDecisionNo(USER_UUID);

      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: LeadStatus.NURTURE } }),
      );
      expect(mockPrisma.nurtureEnrollment.create).toHaveBeenCalled();
      expect(mockPrisma.leadActivity.create).toHaveBeenCalled();
    });

    it('skips nurture enrollment creation if already enrolled', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ ...mockLead, status: LeadStatus.HOT });
      mockPrisma.nurtureEnrollment.findUnique.mockResolvedValue({ leadUuid: LEAD_UUID });

      await service.onDecisionNo(USER_UUID);

      expect(mockPrisma.nurtureEnrollment.create).not.toHaveBeenCalled();
    });

    it('skips if lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.onDecisionNo(USER_UUID)).resolves.toBeUndefined();
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDistributorLeads()
  // ══════════════════════════════════════════════════════════
  describe('getDistributorLeads()', () => {
    it('returns paginated leads for distributor', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([{ ...mockLead, user: { uuid: USER_UUID } }]);
      mockPrisma.lead.count.mockResolvedValue(1);

      const result = await service.getDistributorLeads(DISTRIBUTOR_UUID);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('supports filtering by status', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(0);

      const result = await service.getDistributorLeads(DISTRIBUTOR_UUID, 'HOT');

      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'HOT' }) }),
      );
      expect(result.total).toBe(0);
    });

    it('supports search filter', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(0);

      const result = await service.getDistributorLeads(DISTRIBUTOR_UUID, undefined, 'john');

      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
      );
      expect(result.totalPages).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDistributorTodayFollowups()
  // ══════════════════════════════════════════════════════════
  describe('getDistributorTodayFollowups()', () => {
    it('returns today follow-ups with displayStatus', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([{ ...mockLead, status: LeadStatus.FOLLOWUP, user: {}, activities: [] }]);

      const result = await service.getDistributorTodayFollowups(DISTRIBUTOR_UUID);

      expect(result).toHaveLength(1);
      expect(result[0].displayStatus).toBe('FOLLOWUP');
    });

    it('returns empty array when no followups today', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getDistributorTodayFollowups(DISTRIBUTOR_UUID);

      expect(result).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDistributorLead()
  // ══════════════════════════════════════════════════════════
  describe('getDistributorLead()', () => {
    it('returns lead with funnel progress for authorized distributor', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLeadFull);

      const result = await service.getDistributorLead(LEAD_UUID, DISTRIBUTOR_UUID);

      expect(result.uuid).toBe(LEAD_UUID);
      expect(result.displayStatus).toBeDefined();
      expect(result.funnelProgress).toBeNull();
    });

    it('throws NotFoundException when lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.getDistributorLead(LEAD_UUID, DISTRIBUTOR_UUID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when lead belongs to different distributor', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ ...mockLeadFull, assignedToUuid: 'other-distributor' });

      await expect(service.getDistributorLead(LEAD_UUID, DISTRIBUTOR_UUID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateDistributorLeadStatus()
  // ══════════════════════════════════════════════════════════
  describe('updateDistributorLeadStatus()', () => {
    const dto = { status: LeadStatus.CONTACTED, notes: 'Called them', followupAtDate: undefined };

    it('successfully transitions HOT lead to CONTACTED', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead); // status: HOT

      const result = await service.updateDistributorLeadStatus(LEAD_UUID, DISTRIBUTOR_UUID, dto as any);

      expect(mockPrisma.lead.update).toHaveBeenCalled();
      expect(mockPrisma.leadActivity.create).toHaveBeenCalled();
      expect(result.displayStatus).toBe('CONTACTED');
    });

    it('throws NotFoundException when lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDistributorLeadStatus(LEAD_UUID, DISTRIBUTOR_UUID, dto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for lead not owned by distributor', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ ...mockLead, assignedToUuid: 'other' });

      await expect(
        service.updateDistributorLeadStatus(LEAD_UUID, DISTRIBUTOR_UUID, dto as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when FOLLOWUP status has no notes', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
      const badDto = { status: LeadStatus.FOLLOWUP, notes: '', followupAtDate: undefined };

      await expect(
        service.updateDistributorLeadStatus(LEAD_UUID, DISTRIBUTOR_UUID, badDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid transition (NEW → CONTACTED)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ ...mockLead, status: LeadStatus.NEW });

      await expect(
        service.updateDistributorLeadStatus(LEAD_UUID, DISTRIBUTOR_UUID, dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('promotes user to CUSTOMER when status is MARK_AS_CUSTOMER', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
      const customerDto = { status: LeadStatus.MARK_AS_CUSTOMER, notes: 'Closed', followupAtDate: undefined };
      mockPrisma.lead.update.mockResolvedValue({ ...mockUpdatedLead, status: LeadStatus.MARK_AS_CUSTOMER });

      await service.updateDistributorLeadStatus(LEAD_UUID, DISTRIBUTOR_UUID, customerDto as any);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: UserRole.CUSTOMER } }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // getAllLeads() — admin
  // ══════════════════════════════════════════════════════════
  describe('getAllLeads()', () => {
    it('returns paginated direct leads (distributorUuid = null)', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([{ ...mockLeadAdmin, user: {}, assignedTo: {} }]);
      mockPrisma.lead.count.mockResolvedValue(1);

      const result = await service.getAllLeads();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('supports pagination', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(50);

      const result = await service.getAllLeads(undefined, undefined, 3, 10);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getAdminTodayFollowups()
  // ══════════════════════════════════════════════════════════
  describe('getAdminTodayFollowups()', () => {
    it('returns today follow-ups for admin', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([{ ...mockLeadAdmin, status: LeadStatus.FOLLOWUP, user: {}, assignedTo: {}, activities: [] }]);

      const result = await service.getAdminTodayFollowups();

      expect(result).toHaveLength(1);
    });

    it('returns empty when no followups today', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      expect(await service.getAdminTodayFollowups()).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getAdminLead()
  // ══════════════════════════════════════════════════════════
  describe('getAdminLead()', () => {
    it('returns lead with funnel progress and payments', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        ...mockLeadAdmin,
        user: { uuid: USER_UUID, fullName: 'Test', email: 'test@test.com', country: 'IN', avatarUrl: null },
        assignedTo: { uuid: ADMIN_UUID, fullName: 'Admin' },
        distributor: null,
        activities: [],
        nurtureEnrollment: null,
      });

      const result = await service.getAdminLead(LEAD_UUID);

      expect(result.uuid).toBe(LEAD_UUID);
      expect(result.payments).toEqual([]);
      expect(result.funnelProgress).toBeNull();
    });

    it('throws NotFoundException when lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.getAdminLead(LEAD_UUID)).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getLeadsForDistributor() — admin viewing distributor's leads
  // ══════════════════════════════════════════════════════════
  describe('getLeadsForDistributor()', () => {
    it('returns paginated leads for a specific distributor', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([{ ...mockLead, user: {}, assignedTo: {} }]);
      mockPrisma.lead.count.mockResolvedValue(1);

      const result = await service.getLeadsForDistributor(DISTRIBUTOR_UUID);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('applies search filter', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(0);

      await service.getLeadsForDistributor(DISTRIBUTOR_UUID, undefined, 'john');

      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ distributorUuid: DISTRIBUTOR_UUID }) }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateAdminLeadStatus()
  // ══════════════════════════════════════════════════════════
  describe('updateAdminLeadStatus()', () => {
    const dto = { status: LeadStatus.CONTACTED, notes: 'Admin action', followupAtDate: undefined };

    it('successfully transitions a direct lead (HOT → CONTACTED)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLeadAdmin); // distributorUuid: null, status: HOT

      const result = await service.updateAdminLeadStatus(LEAD_UUID, ADMIN_UUID, dto as any);

      expect(mockPrisma.lead.update).toHaveBeenCalled();
      expect(result.displayStatus).toBe('CONTACTED');
    });

    it('throws NotFoundException when lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.updateAdminLeadStatus(LEAD_UUID, ADMIN_UUID, dto as any)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when lead belongs to a distributor', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead); // distributorUuid !== null

      await expect(service.updateAdminLeadStatus(LEAD_UUID, ADMIN_UUID, dto as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for invalid transition (NEW → CONTACTED)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ ...mockLeadAdmin, status: LeadStatus.NEW });

      await expect(service.updateAdminLeadStatus(LEAD_UUID, ADMIN_UUID, dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getAdminNotifications()
  // ══════════════════════════════════════════════════════════
  describe('getAdminNotifications()', () => {
    it('returns followupsToday and overdueFollowups', async () => {
      const activityShape = {
        followupAt: new Date(),
        notes: 'Call them',
        lead: { uuid: LEAD_UUID, phone: null, user: { fullName: 'Test User' } },
      };
      mockPrisma.leadActivity.findMany
        .mockResolvedValueOnce([activityShape])
        .mockResolvedValueOnce([]);

      const result = await service.getAdminNotifications();

      expect(result.followupsToday).toHaveLength(1);
      expect(result.overdueFollowups).toHaveLength(0);
      expect(result.followupsToday[0].leadUuid).toBe(LEAD_UUID);
    });

    it('returns empty arrays when no notifications', async () => {
      mockPrisma.leadActivity.findMany.mockResolvedValue([]);

      const result = await service.getAdminNotifications();

      expect(result.followupsToday).toHaveLength(0);
      expect(result.overdueFollowups).toHaveLength(0);
    });
  });
});
