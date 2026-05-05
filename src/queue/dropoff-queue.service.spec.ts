import { Test, TestingModule } from '@nestjs/testing';
import { DropoffQueueService } from './dropoff-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { SocialConfigService } from '../social/social-config.service';
import { QueueStatus } from '@prisma/client';

const USER_UUID = 'user-uuid-1';

const mockSequenceSteps = [
  {
    uuid: 'seq-1',
    dayOffset: 0, // immediate (delayHours)
    templateUuid: 'tpl-1',
    channel: 'WHATSAPP',
    isActive: true,
    order: 0,
  },
  {
    uuid: 'seq-2',
    dayOffset: 3,
    templateUuid: 'tpl-2',
    channel: 'WHATSAPP',
    isActive: true,
    order: 1,
  },
];

const mockTemplate = {
  uuid: 'tpl-1',
  name: 'Drop reminder',
  type: 'TEXT',
  content: 'Hi {name}, come back!',
  mediaUrl: null,
  caption: null,
  isActive: true,
};

const mockPrisma = {
  dropoffQueue: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  dropoffSequence: { findMany: jest.fn() },
  funnelProgress: { findFirst: jest.fn() },
  lead: { findFirst: jest.fn() },
  messageTemplate: { findUnique: jest.fn() },
};

const mockWhatsApp = { sendMessage: jest.fn() };

const mockConfig = {
  getNumber: jest.fn().mockResolvedValue(2), // DROPOFF_CHECK_HOURS=2
  get: jest.fn(),
  getAll: jest.fn(),
};

describe('DropoffQueueService', () => {
  let service: DropoffQueueService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWhatsApp.sendMessage.mockResolvedValue(undefined);
    mockConfig.getNumber.mockResolvedValue(2);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DropoffQueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsAppService, useValue: mockWhatsApp },
        { provide: SocialConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(DropoffQueueService);
  });

  describe('enqueueIfEligible', () => {
    it('skips when user already paid', async () => {
      mockPrisma.dropoffQueue.findFirst.mockResolvedValue(null);
      mockPrisma.funnelProgress.findFirst.mockResolvedValue({ uuid: 'fp-1' });

      await service.enqueueIfEligible(USER_UUID);

      expect(mockPrisma.dropoffSequence.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.dropoffQueue.createMany).not.toHaveBeenCalled();
    });

    it('skips when already pending in queue', async () => {
      mockPrisma.dropoffQueue.findFirst.mockResolvedValue({ uuid: 'q-1' });

      await service.enqueueIfEligible(USER_UUID);

      expect(mockPrisma.funnelProgress.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.dropoffQueue.createMany).not.toHaveBeenCalled();
    });

    it('creates records with correct sendAt times (delayHours for day=0, days for others)', async () => {
      mockPrisma.dropoffQueue.findFirst.mockResolvedValue(null);
      mockPrisma.funnelProgress.findFirst.mockResolvedValue(null);
      mockPrisma.dropoffSequence.findMany.mockResolvedValue(mockSequenceSteps);
      mockPrisma.dropoffQueue.createMany.mockResolvedValue({ count: 2 });

      const before = Date.now();
      await service.enqueueIfEligible(USER_UUID);
      const after = Date.now();

      const call = mockPrisma.dropoffQueue.createMany.mock.calls[0][0];
      expect(call.data).toHaveLength(2);

      // step 0: dayOffset=0 → delayHours (2h) from now
      const step0SendAt = call.data[0].sendAt.getTime();
      const expectedMin = before + 2 * 60 * 60 * 1000;
      const expectedMax = after + 2 * 60 * 60 * 1000;
      expect(step0SendAt).toBeGreaterThanOrEqual(expectedMin);
      expect(step0SendAt).toBeLessThanOrEqual(expectedMax);

      // step 1: dayOffset=3 → 3 days from now
      const step1SendAt = call.data[1].sendAt.getTime();
      expect(step1SendAt).toBeGreaterThanOrEqual(
        before + 3 * 24 * 60 * 60 * 1000,
      );
    });
  });

  describe('sendPendingDropoffs', () => {
    it('cancels all pending when user has paid since enqueue', async () => {
      const dueItem = {
        uuid: 'q-1',
        userUuid: USER_UUID,
        templateUuid: 'tpl-1',
        channel: 'WHATSAPP',
        user: { fullName: 'Rahul', profile: { phone: '+919876543210' } },
      };
      mockPrisma.dropoffQueue.findMany.mockResolvedValue([dueItem]);
      mockPrisma.funnelProgress.findFirst.mockResolvedValue({ uuid: 'fp-1' });
      mockPrisma.dropoffQueue.updateMany.mockResolvedValue({ count: 1 });

      await service.sendPendingDropoffs();

      expect(mockPrisma.dropoffQueue.updateMany).toHaveBeenCalledWith({
        where: {
          userUuid: USER_UUID,
          status: QueueStatus.PENDING,
        },
        data: { status: QueueStatus.CANCELLED },
      });
      expect(mockWhatsApp.sendMessage).not.toHaveBeenCalled();
    });

    it('sends WhatsApp for due records', async () => {
      const dueItem = {
        uuid: 'q-1',
        userUuid: USER_UUID,
        templateUuid: 'tpl-1',
        channel: 'WHATSAPP',
        user: { fullName: 'Rahul', profile: { phone: '+919876543210' } },
      };
      mockPrisma.dropoffQueue.findMany.mockResolvedValue([dueItem]);
      mockPrisma.funnelProgress.findFirst.mockResolvedValue(null);
      mockPrisma.lead.findFirst.mockResolvedValue({
        distributor: { distributorCode: 'RAJ123' },
      });
      mockPrisma.messageTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.dropoffQueue.update.mockResolvedValue({});

      await service.sendPendingDropoffs();

      expect(mockWhatsApp.sendMessage).toHaveBeenCalledWith(
        '+919876543210',
        'Hi Rahul, come back!',
      );
      expect(mockPrisma.dropoffQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: 'q-1' },
          data: expect.objectContaining({ status: QueueStatus.SENT }),
        }),
      );
    });
  });
});
