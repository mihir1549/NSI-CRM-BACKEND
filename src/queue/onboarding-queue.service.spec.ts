import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingQueueService } from './onboarding-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { QueueStatus } from '@prisma/client';

const DIST_UUID = 'dist-uuid-1';

const mockSequenceSteps = [
  {
    uuid: 'seq-1',
    dayOffset: 0,
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
  name: 'Welcome',
  type: 'TEXT',
  content: 'Hi {name}, welcome!',
  mediaUrl: null,
  caption: null,
  isActive: true,
};

const mockPrisma = {
  onboardingQueue: {
    findFirst: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  onboardingSequence: { findMany: jest.fn() },
  messageTemplate: { findUnique: jest.fn() },
  userProfile: { findUnique: jest.fn() },
};

const mockWhatsApp = { sendMessage: jest.fn() };

describe('OnboardingQueueService', () => {
  let service: OnboardingQueueService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWhatsApp.sendMessage.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingQueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsAppService, useValue: mockWhatsApp },
      ],
    }).compile();

    service = module.get(OnboardingQueueService);
  });

  describe('enqueueForDistributor', () => {
    it('skips when already enqueued', async () => {
      mockPrisma.onboardingQueue.findFirst.mockResolvedValue({ uuid: 'q-1' });

      await service.enqueueForDistributor(DIST_UUID);

      expect(mockPrisma.onboardingSequence.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.onboardingQueue.createMany).not.toHaveBeenCalled();
    });

    it('skips when no active sequence steps', async () => {
      mockPrisma.onboardingQueue.findFirst.mockResolvedValue(null);
      mockPrisma.onboardingSequence.findMany.mockResolvedValue([]);

      await service.enqueueForDistributor(DIST_UUID);

      expect(mockPrisma.onboardingQueue.createMany).not.toHaveBeenCalled();
    });

    it('creates correct number of queue records', async () => {
      mockPrisma.onboardingQueue.findFirst.mockResolvedValue(null);
      mockPrisma.onboardingSequence.findMany.mockResolvedValue(mockSequenceSteps);
      mockPrisma.onboardingQueue.createMany.mockResolvedValue({ count: 2 });

      await service.enqueueForDistributor(DIST_UUID);

      expect(mockPrisma.onboardingQueue.createMany).toHaveBeenCalledTimes(1);
      const call = mockPrisma.onboardingQueue.createMany.mock.calls[0][0];
      expect(call.data).toHaveLength(2);
      expect(call.data[0].distributorUuid).toBe(DIST_UUID);
      expect(call.data[0].status).toBe(QueueStatus.PENDING);
    });
  });

  describe('sendPendingOnboarding', () => {
    it('sends WhatsApp for due records and marks SENT', async () => {
      const dueItem = {
        uuid: 'q-1',
        distributorUuid: DIST_UUID,
        templateUuid: 'tpl-1',
        channel: 'WHATSAPP',
        distributor: { fullName: 'Raj', distributorCode: 'RAJ123' },
      };
      mockPrisma.onboardingQueue.findMany.mockResolvedValue([dueItem]);
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        phone: '+919876543210',
      });
      mockPrisma.messageTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.onboardingQueue.update.mockResolvedValue({});

      await service.sendPendingOnboarding();

      expect(mockWhatsApp.sendMessage).toHaveBeenCalledWith(
        '+919876543210',
        'Hi Raj, welcome!',
      );
      expect(mockPrisma.onboardingQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: 'q-1' },
          data: expect.objectContaining({ status: QueueStatus.SENT }),
        }),
      );
    });

    it('marks record FAILED on error', async () => {
      const dueItem = {
        uuid: 'q-1',
        distributorUuid: DIST_UUID,
        templateUuid: 'tpl-missing',
        channel: 'WHATSAPP',
        distributor: { fullName: 'Raj', distributorCode: 'RAJ123' },
      };
      mockPrisma.onboardingQueue.findMany.mockResolvedValue([dueItem]);
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        phone: '+919876543210',
      });
      mockPrisma.messageTemplate.findUnique.mockResolvedValue(null); // template not found
      mockPrisma.onboardingQueue.update.mockResolvedValue({});

      await service.sendPendingOnboarding();

      expect(mockPrisma.onboardingQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: 'q-1' },
          data: expect.objectContaining({
            status: QueueStatus.FAILED,
            failureReason: expect.stringContaining('not found'),
          }),
        }),
      );
    });
  });
});
