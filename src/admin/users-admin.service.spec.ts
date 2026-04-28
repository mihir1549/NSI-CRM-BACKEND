import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersAdminService } from './users-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { DistributorSubscriptionHistoryService } from '../distributor/distributor-subscription-history.service';
import { LeadsService } from '../leads/leads.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const USER_UUID = '11111111-1111-1111-1111-111111111111';
const ACTOR_UUID = '55555555-5555-5555-5555-555555555555';
const SUB_UUID = '33333333-3333-3333-3333-333333333333';
const IP = '127.0.0.1';

const mockActiveUser = {
  uuid: USER_UUID,
  fullName: 'Rahul Sharma',
  email: 'rahul@example.com',
  role: 'CUSTOMER',
  status: 'ACTIVE',
};

const mockDistributorUser = {
  ...mockActiveUser,
  role: 'DISTRIBUTOR',
};

const mockSuspendedUser = {
  ...mockActiveUser,
  status: 'SUSPENDED',
};

const mockActiveSub = {
  uuid: SUB_UUID,
  userUuid: USER_UUID,
  razorpaySubscriptionId: 'sub_mock123',
  status: 'ACTIVE',
};

// ─── Mock dependencies ────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  distributorSubscription: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  authSession: {
    deleteMany: jest.fn(),
  },
  funnelStep: {
    count: jest.fn().mockResolvedValue(5),
  },
};

const mockAuditService = { log: jest.fn() };

const mockMailService = {
  sendSuspensionEmail: jest.fn(),
  sendReactivationEmail: jest.fn(),
  sendSubscriptionCancelledByAdminEmail: jest.fn(),
};

const mockHistoryService = { log: jest.fn() };

const mockLeadsService = { reassignLeadsOnSuspension: jest.fn() };

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const cfg: Record<string, string> = { PAYMENT_PROVIDER: 'mock' };
    return cfg[key] ?? defaultValue;
  }),
};

describe('UsersAdminService', () => {
  let service: UsersAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersAdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: MailService, useValue: mockMailService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: DistributorSubscriptionHistoryService,
          useValue: mockHistoryService,
        },
        { provide: LeadsService, useValue: mockLeadsService },
      ],
    }).compile();

    service = module.get<UsersAdminService>(UsersAdminService);
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const cfg: Record<string, string> = { PAYMENT_PROVIDER: 'mock' };
        return cfg[key] ?? defaultValue;
      },
    );
    mockHistoryService.log.mockResolvedValue(undefined);
    mockLeadsService.reassignLeadsOnSuspension.mockResolvedValue(undefined);
    mockPrisma.authSession.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.funnelStep.count.mockResolvedValue(5);
    mockPrisma.user.findFirst.mockResolvedValue(null);
  });

  // ══════════════════════════════════════════════════════════
  // suspendUser()
  // ══════════════════════════════════════════════════════════
  describe('suspendUser()', () => {
    it('throws NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.suspendUser(USER_UUID, ACTOR_UUID, IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if target is SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        role: 'SUPER_ADMIN',
      });

      await expect(
        service.suspendUser(USER_UUID, ACTOR_UUID, IP),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if user is already suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockSuspendedUser);

      await expect(
        service.suspendUser(USER_UUID, ACTOR_UUID, IP),
      ).rejects.toThrow(BadRequestException);
    });

    it('suspends a regular CUSTOMER — sets status SUSPENDED and deletes sessions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({});

      await service.suspendUser(USER_UUID, ACTOR_UUID, IP);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: USER_UUID },
          data: expect.objectContaining({ status: 'SUSPENDED' }),
        }),
      );
      expect(mockPrisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: { userUuid: USER_UUID },
      });
    });

    it('sends suspension email (fire and forget)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({});

      await service.suspendUser(USER_UUID, ACTOR_UUID, IP);

      expect(mockMailService.sendSuspensionEmail).toHaveBeenCalledWith(
        mockActiveUser.email,
        mockActiveUser.fullName,
        expect.any(String),
      );
    });

    it('logs audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({});

      await service.suspendUser(USER_UUID, ACTOR_UUID, IP);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_SUSPENDED' }),
      );
    });

    it('cancels ACTIVE distributor subscription and logs SUSPEND_CANCELLED history', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributorUser);
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: ACTOR_UUID, role: 'SUPER_ADMIN' });
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(
        mockActiveSub,
      );
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.suspendUser(USER_UUID, ACTOR_UUID, IP);

      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: SUB_UUID },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'CUSTOMER',
            joinLinkActive: false,
          }),
        }),
      );
      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'SUSPEND_CANCELLED',
          userUuid: USER_UUID,
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // reactivateUser()
  // ══════════════════════════════════════════════════════════
  describe('reactivateUser()', () => {
    it('throws NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.reactivateUser(USER_UUID, ACTOR_UUID, IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if user is not suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(
        service.reactivateUser(USER_UUID, ACTOR_UUID, IP),
      ).rejects.toThrow(BadRequestException);
    });

    it('reactivates suspended user — sets status ACTIVE', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockSuspendedUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);

      await service.reactivateUser(USER_UUID, ACTOR_UUID, IP);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: USER_UUID },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('sends reactivation email (fire and forget)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockSuspendedUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);

      await service.reactivateUser(USER_UUID, ACTOR_UUID, IP);

      expect(mockMailService.sendReactivationEmail).toHaveBeenCalledWith(
        mockSuspendedUser.email,
        mockSuspendedUser.fullName,
      );
    });

    it('logs audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockSuspendedUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(null);

      await service.reactivateUser(USER_UUID, ACTOR_UUID, IP);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_REACTIVATED' }),
      );
    });

    it('does NOT restore DISTRIBUTOR role — user stays CUSTOMER after reactivation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockSuspendedUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue({
        ...mockActiveSub,
        status: 'CANCELLED',
      });

      const result = await service.reactivateUser(USER_UUID, ACTOR_UUID, IP);

      // note field is returned explaining re-subscribe is needed
      expect(result.note).toContain('re-subscribe');
      // user.update does NOT set role=DISTRIBUTOR
      expect(mockPrisma.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'DISTRIBUTOR' }),
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateUserRole()
  // ══════════════════════════════════════════════════════════
  describe('updateUserRole()', () => {
    const dto = { role: 'CUSTOMER' as any };

    it('throws ForbiddenException when trying to assign SUPER_ADMIN role', async () => {
      await expect(
        service.updateUserRole(
          USER_UUID,
          { role: 'SUPER_ADMIN' as any },
          ACTOR_UUID,
          IP,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when trying to assign DISTRIBUTOR role directly', async () => {
      await expect(
        service.updateUserRole(
          USER_UUID,
          { role: 'DISTRIBUTOR' as any },
          ACTOR_UUID,
          IP,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserRole(USER_UUID, dto, ACTOR_UUID, IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if current role is SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        role: 'SUPER_ADMIN',
      });

      await expect(
        service.updateUserRole(USER_UUID, dto, ACTOR_UUID, IP),
      ).rejects.toThrow(ForbiddenException);
    });

    it('changes role successfully and logs audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateUserRole(
        USER_UUID,
        { role: 'TEAM_MEMBER' as any },
        ACTOR_UUID,
        IP,
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: USER_UUID },
          data: { role: 'TEAM_MEMBER' },
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_ROLE_CHANGED' }),
      );
    });

    it('cancels subscription and logs ROLE_CHANGE_CANCELLED when changing FROM DISTRIBUTOR', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributorUser);
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(
        mockActiveSub,
      );
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateUserRole(USER_UUID, dto, ACTOR_UUID, IP);

      expect(mockPrisma.distributorSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: SUB_UUID },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(mockHistoryService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ROLE_CHANGE_CANCELLED',
          userUuid: USER_UUID,
        }),
      );
    });

    it('deactivates join link when changing FROM DISTRIBUTOR', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributorUser);
      mockPrisma.distributorSubscription.findUnique.mockResolvedValue(
        mockActiveSub,
      );
      mockPrisma.distributorSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateUserRole(USER_UUID, dto, ACTOR_UUID, IP);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: USER_UUID },
          data: { joinLinkActive: false },
        }),
      );
    });
  });
});
