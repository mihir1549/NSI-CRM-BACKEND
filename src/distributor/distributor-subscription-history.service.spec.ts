import { Test, TestingModule } from '@nestjs/testing';
import { DistributorSubscriptionHistoryService } from './distributor-subscription-history.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_UUID = '11111111-1111-1111-1111-111111111111';
const PLAN_UUID = '22222222-2222-2222-2222-222222222222';

const mockHistory = {
  create: jest.fn(),
  findMany: jest.fn(),
};

const mockPrisma = {
  distributorSubscriptionHistory: mockHistory,
};

describe('DistributorSubscriptionHistoryService', () => {
  let service: DistributorSubscriptionHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorSubscriptionHistoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DistributorSubscriptionHistoryService>(
      DistributorSubscriptionHistoryService,
    );
    jest.clearAllMocks();
    mockHistory.create.mockResolvedValue({});
    mockHistory.findMany.mockResolvedValue([]);
  });

  // ══════════════════════════════════════════════════════════
  // log()
  // ══════════════════════════════════════════════════════════
  describe('log()', () => {
    it('creates a history record with all provided fields', async () => {
      await service.log({
        userUuid: USER_UUID,
        planUuid: PLAN_UUID,
        razorpaySubscriptionId: 'sub_mock123',
        event: 'SUBSCRIBED',
        amount: 999,
        invoiceNumber: 'INV-2026-000001',
        notes: 'First subscription activated',
      });

      expect(mockHistory.create).toHaveBeenCalledWith({
        data: {
          userUuid: USER_UUID,
          planUuid: PLAN_UUID,
          razorpaySubscriptionId: 'sub_mock123',
          event: 'SUBSCRIBED',
          amount: 999,
          invoiceNumber: 'INV-2026-000001',
          notes: 'First subscription activated',
        },
      });
    });

    it('coerces all nullable optional fields to null', async () => {
      await service.log({ userUuid: USER_UUID, event: 'EXPIRED' });

      expect(mockHistory.create).toHaveBeenCalledWith({
        data: {
          userUuid: USER_UUID,
          planUuid: null,
          razorpaySubscriptionId: null,
          event: 'EXPIRED',
          amount: null,
          invoiceNumber: null,
          notes: null,
        },
      });
    });

    it('swallows DB errors (does not rethrow)', async () => {
      mockHistory.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.log({ userUuid: USER_UUID, event: 'CHARGED' }),
      ).resolves.toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════
  // getHistory()
  // ══════════════════════════════════════════════════════════
  describe('getHistory()', () => {
    it('returns history ordered by createdAt desc with plan included', async () => {
      const rows = [
        {
          event: 'CHARGED',
          createdAt: new Date('2026-04-09'),
          plan: { name: 'Pro', amount: 999 },
        },
        {
          event: 'SUBSCRIBED',
          createdAt: new Date('2026-03-01'),
          plan: { name: 'Pro', amount: 999 },
        },
      ];
      mockHistory.findMany.mockResolvedValue(rows);

      const result = await service.getHistory(USER_UUID);

      expect(result).toEqual(rows);
      expect(mockHistory.findMany).toHaveBeenCalledWith({
        where: { userUuid: USER_UUID },
        orderBy: { createdAt: 'desc' },
        include: { plan: { select: { name: true, amount: true } } },
        take: 50,
      });
    });

    it('returns empty array when no history exists', async () => {
      mockHistory.findMany.mockResolvedValue([]);

      const result = await service.getHistory(USER_UUID);

      expect(result).toEqual([]);
    });
  });
});
