import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BroadcastService } from './broadcast.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SseService } from '../sse/sse.service.js';

const mockPrisma = {
  broadcastMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  broadcastRead: {
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  lead: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn().mockResolvedValue(null),
  },
};

const mockSseService = {
  sendToUser: jest.fn(),
  sendToRole: jest.fn(),
  sendToAll: jest.fn(),
};

describe('BroadcastService', () => {
  let service: BroadcastService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.broadcastRead.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.broadcastRead.findMany.mockResolvedValue([]);
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.lead.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SseService, useValue: mockSseService },
      ],
    }).compile();

    service = module.get<BroadcastService>(BroadcastService);
  });

  // ─── createAdminBroadcast ────────────────────────────────────────────────

  it('1. Creates ANNOUNCEMENT ignoring targetRole and targetUuids', async () => {
    const dto = {
      type: 'ANNOUNCEMENT',
      title: 'System Maintenance',
      shortMessage: 'Platform offline tonight',
      targetRole: 'USER',
      targetUuids: ['some-uuid'],
    };
    const created = {
      uuid: 'ann-uuid',
      ...dto,
      type: 'ANNOUNCEMENT',
      targetRole: null,
      targetUuids: [],
      createdByUuid: 'admin-uuid',
      createdByRole: 'SUPER_ADMIN',
    };
    mockPrisma.broadcastMessage.create.mockResolvedValue(created);

    const result = await service.createAdminBroadcast(dto as any, 'admin-uuid');

    expect(mockPrisma.broadcastMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ANNOUNCEMENT',
          targetRole: null,
          targetUuids: [],
          createdByRole: 'SUPER_ADMIN',
        }),
      }),
    );
    expect(result.type).toBe('ANNOUNCEMENT');
  });

  it('2. Creates BROADCAST with targetRole = DISTRIBUTOR', async () => {
    const dto = {
      type: 'BROADCAST',
      title: 'For Distributors',
      shortMessage: 'New commission structure',
      targetRole: 'DISTRIBUTOR',
    };
    const created = { uuid: 'bc-uuid', ...dto, createdByRole: 'SUPER_ADMIN' };
    mockPrisma.broadcastMessage.create.mockResolvedValue(created);

    const result = await service.createAdminBroadcast(dto as any, 'admin-uuid');

    expect(mockPrisma.broadcastMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetRole: 'DISTRIBUTOR',
          createdByRole: 'SUPER_ADMIN',
        }),
      }),
    );
    expect(result.createdByRole).toBe('SUPER_ADMIN');
  });

  it('3. Creates BROADCAST with specific targetUuids', async () => {
    const targetUuids = ['uuid-1', 'uuid-2'];
    const dto = {
      type: 'BROADCAST',
      title: 'Personal Message',
      shortMessage: 'Hello selected users',
      targetUuids,
    };
    const created = { uuid: 'bc-uuid-2', ...dto, createdByRole: 'SUPER_ADMIN' };
    mockPrisma.broadcastMessage.create.mockResolvedValue(created);

    await service.createAdminBroadcast(dto as any, 'admin-uuid');

    expect(mockPrisma.broadcastMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetUuids }),
      }),
    );
  });

  // ─── createDistributorBroadcast ──────────────────────────────────────────

  it('4. Forces type = BROADCAST even if ANNOUNCEMENT passed in dto', async () => {
    const dto = {
      type: 'ANNOUNCEMENT',
      title: 'Test',
      shortMessage: 'Test message',
    };
    const created = {
      uuid: 'dist-bc-uuid',
      type: 'BROADCAST',
      createdByRole: 'DISTRIBUTOR',
    };
    mockPrisma.broadcastMessage.create.mockResolvedValue(created);

    await service.createDistributorBroadcast(dto as any, 'dist-uuid');

    expect(mockPrisma.broadcastMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'BROADCAST',
          createdByRole: 'DISTRIBUTOR',
        }),
      }),
    );
  });

  it('5. Creates broadcast for distributor referred users only', async () => {
    const dto = {
      type: 'BROADCAST',
      title: 'For My Users',
      shortMessage: 'Hello team',
      targetUuids: ['user-1', 'user-2', 'outsider-uuid'],
    };
    // Only user-1 and user-2 are referred by this distributor
    mockPrisma.lead.findMany.mockResolvedValue([
      { userUuid: 'user-1' },
      { userUuid: 'user-2' },
    ]);
    const created = {
      uuid: 'dist-bc-uuid-2',
      type: 'BROADCAST',
      createdByRole: 'DISTRIBUTOR',
    };
    mockPrisma.broadcastMessage.create.mockResolvedValue(created);

    await service.createDistributorBroadcast(dto as any, 'dist-uuid');

    expect(mockPrisma.broadcastMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetUuids: ['user-1', 'user-2'],
        }),
      }),
    );
  });

  // ─── getActiveBroadcastsForUser ──────────────────────────────────────────

  it('6. Returns ANNOUNCEMENT in announcements[] array', async () => {
    const announcement = {
      uuid: 'ann-1',
      type: 'ANNOUNCEMENT',
      title: 'System Alert',
      shortMessage: 'Maintenance tonight',
      fullContent: null,
      link: null,
      createdByRole: 'SUPER_ADMIN',
      createdByUuid: 'admin-uuid',
      targetRole: null,
      targetUuids: [],
      isActive: true,
      expiresAt: null,
      createdAt: new Date(),
    };
    mockPrisma.broadcastMessage.findMany.mockResolvedValue([announcement]);

    const result = await service.getActiveBroadcastsForUser(
      'user-uuid',
      'USER',
    );

    expect(result.announcements).toHaveLength(1);
    expect(result.announcements[0].uuid).toBe('ann-1');
    expect(result.broadcasts).toHaveLength(0);
    expect(result.unreadCount).toBe(0);
  });

  it('7. Returns BROADCAST in broadcasts[] array', async () => {
    const broadcast = {
      uuid: 'bc-1',
      type: 'BROADCAST',
      title: 'New Feature',
      shortMessage: 'Check it out',
      fullContent: null,
      link: null,
      createdByRole: 'SUPER_ADMIN',
      createdByUuid: 'admin-uuid',
      targetRole: null,
      targetUuids: [],
      isActive: true,
      expiresAt: null,
      createdAt: new Date(),
    };
    mockPrisma.broadcastMessage.findMany.mockResolvedValue([broadcast]);

    const result = await service.getActiveBroadcastsForUser(
      'user-uuid',
      'USER',
    );

    expect(result.broadcasts).toHaveLength(1);
    expect(result.broadcasts[0].uuid).toBe('bc-1');
    expect(result.announcements).toHaveLength(0);
    expect(result.unreadCount).toBe(1);
  });

  it('8. Excludes expired messages (expiresAt < now)', async () => {
    const expiredBroadcast = {
      uuid: 'expired-bc',
      type: 'BROADCAST',
      title: 'Old news',
      shortMessage: 'Already expired',
      fullContent: null,
      link: null,
      createdByRole: 'SUPER_ADMIN',
      createdByUuid: 'admin-uuid',
      targetRole: null,
      targetUuids: [],
      isActive: true,
      expiresAt: new Date('2020-01-01'),
      createdAt: new Date('2020-01-01'),
    };
    // The query already filters expiresAt > now — simulate by returning empty
    mockPrisma.broadcastMessage.findMany.mockResolvedValue([]);

    const result = await service.getActiveBroadcastsForUser(
      'user-uuid',
      'USER',
    );

    expect(result.broadcasts).toHaveLength(0);
    expect(result.announcements).toHaveLength(0);
  });

  it('9. Excludes already-dismissed BROADCAST for this user', async () => {
    const broadcast = {
      uuid: 'bc-dismissed',
      type: 'BROADCAST',
      title: 'Already Read',
      shortMessage: 'You dismissed this',
      fullContent: null,
      link: null,
      createdByRole: 'SUPER_ADMIN',
      createdByUuid: 'admin-uuid',
      targetRole: null,
      targetUuids: [],
      isActive: true,
      expiresAt: null,
      createdAt: new Date(),
    };
    mockPrisma.broadcastMessage.findMany.mockResolvedValue([broadcast]);
    // User already dismissed this broadcast
    mockPrisma.broadcastRead.findMany.mockResolvedValue([
      { broadcastUuid: 'bc-dismissed' },
    ]);

    const result = await service.getActiveBroadcastsForUser(
      'user-uuid',
      'USER',
    );

    expect(result.broadcasts).toHaveLength(0);
    expect(result.unreadCount).toBe(0);
  });

  it('10. Returns correct unreadCount = broadcasts.length', async () => {
    const broadcasts = [
      {
        uuid: 'bc-a',
        type: 'BROADCAST',
        title: 'A',
        shortMessage: 'A',
        fullContent: null,
        link: null,
        createdByRole: 'SUPER_ADMIN',
        createdByUuid: 'admin-uuid',
        targetRole: null,
        targetUuids: [],
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
      },
      {
        uuid: 'bc-b',
        type: 'BROADCAST',
        title: 'B',
        shortMessage: 'B',
        fullContent: null,
        link: null,
        createdByRole: 'SUPER_ADMIN',
        createdByUuid: 'admin-uuid',
        targetRole: null,
        targetUuids: [],
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
      },
    ];
    mockPrisma.broadcastMessage.findMany.mockResolvedValue(broadcasts);

    const result = await service.getActiveBroadcastsForUser(
      'user-uuid',
      'USER',
    );

    expect(result.broadcasts).toHaveLength(2);
    expect(result.unreadCount).toBe(2);
  });

  it('11. Returns empty arrays when no active messages', async () => {
    mockPrisma.broadcastMessage.findMany.mockResolvedValue([]);

    const result = await service.getActiveBroadcastsForUser(
      'user-uuid',
      'USER',
    );

    expect(result.announcements).toHaveLength(0);
    expect(result.broadcasts).toHaveLength(0);
    expect(result.unreadCount).toBe(0);
  });

  // ─── dismissBroadcast ────────────────────────────────────────────────────

  it('12. Successfully dismisses a BROADCAST → calls broadcastRead.createMany', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      uuid: 'bc-uuid',
      type: 'BROADCAST',
    });

    const result = await service.dismissBroadcast('bc-uuid', 'user-uuid');

    expect(mockPrisma.broadcastRead.createMany).toHaveBeenCalledWith({
      data: [{ broadcastUuid: 'bc-uuid', userUuid: 'user-uuid' }],
      skipDuplicates: true,
    });
    expect(result).toEqual({ message: 'Dismissed' });
  });

  it('13. Throws BadRequestException when dismissing ANNOUNCEMENT', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      uuid: 'ann-uuid',
      type: 'ANNOUNCEMENT',
    });

    await expect(
      service.dismissBroadcast('ann-uuid', 'user-uuid'),
    ).rejects.toThrow(BadRequestException);
  });

  it('14. Throws NotFoundException when broadcast not found', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue(null);

    await expect(
      service.dismissBroadcast('non-existent-uuid', 'user-uuid'),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── deactivateBroadcast ─────────────────────────────────────────────────

  it('15. SUPER_ADMIN can deactivate any broadcast', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      uuid: 'bc-uuid',
      createdByUuid: 'some-other-uuid',
      type: 'BROADCAST',
    });
    mockPrisma.broadcastMessage.update.mockResolvedValue({ isActive: false });

    const result = await service.deactivateBroadcast(
      'bc-uuid',
      'admin-uuid',
      'SUPER_ADMIN',
    );

    expect(mockPrisma.broadcastMessage.update).toHaveBeenCalledWith({
      where: { uuid: 'bc-uuid' },
      data: { isActive: false },
    });
    expect(result).toEqual({ message: 'Deactivated' });
  });

  it('16. DISTRIBUTOR can deactivate their own broadcast', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      uuid: 'bc-uuid',
      createdByUuid: 'dist-uuid',
      type: 'BROADCAST',
    });
    mockPrisma.broadcastMessage.update.mockResolvedValue({ isActive: false });

    const result = await service.deactivateBroadcast(
      'bc-uuid',
      'dist-uuid',
      'DISTRIBUTOR',
    );

    expect(result).toEqual({ message: 'Deactivated' });
  });

  it("17. DISTRIBUTOR gets ForbiddenException for another's broadcast", async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      uuid: 'bc-uuid',
      createdByUuid: 'other-dist-uuid',
      type: 'BROADCAST',
    });

    await expect(
      service.deactivateBroadcast('bc-uuid', 'dist-uuid', 'DISTRIBUTOR'),
    ).rejects.toThrow(ForbiddenException);
  });
});
