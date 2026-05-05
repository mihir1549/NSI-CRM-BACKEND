import { Test, TestingModule } from '@nestjs/testing';
import { FollowupQueueService } from './followup-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { QueueStatus } from '@prisma/client';

const LEAD_UUID = 'lead-uuid-1';
const USER_UUID = 'user-uuid-1';

const mockTemplate = {
  uuid: 'tpl-1',
  name: 'Follow up',
  type: 'TEXT',
  content: 'Hey {name}, follow this {join_link}',
  mediaUrl: null,
  caption: null,
  isActive: true,
};

const mockPrisma = {
  lead: { findUnique: jest.fn(), findFirst: jest.fn() },
  followupQueue: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  followupSequence: { findMany: jest.fn() },
  funnelProgress: { findFirst: jest.fn() },
  messageTemplate: { findUnique: jest.fn() },
};

const mockWhatsApp = { sendMessage: jest.fn() };

describe('FollowupQueueService', () => {
  let service: FollowupQueueService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWhatsApp.sendMessage.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowupQueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsAppService, useValue: mockWhatsApp },
      ],
    }).compile();

    service = module.get(FollowupQueueService);
  });

  describe('enqueueForLead', () => {
    it('skips when user has no phone', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        uuid: LEAD_UUID,
        phone: null,
        user: { profile: { phone: null } },
      });

      await service.enqueueForLead(LEAD_UUID);

      expect(mockPrisma.followupQueue.createMany).not.toHaveBeenCalled();
    });

    it('skips when already enqueued', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        uuid: LEAD_UUID,
        phone: '+919876543210',
        user: null,
      });
      mockPrisma.followupQueue.findFirst.mockResolvedValue({ uuid: 'q-1' });

      await service.enqueueForLead(LEAD_UUID);

      expect(mockPrisma.followupSequence.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.followupQueue.createMany).not.toHaveBeenCalled();
    });
  });

  describe('sendPendingFollowups', () => {
    it('cancels all pending when user has paid', async () => {
      const dueItem = {
        uuid: 'q-1',
        leadUuid: LEAD_UUID,
        templateUuid: 'tpl-1',
        channel: 'WHATSAPP',
      };
      mockPrisma.followupQueue.findMany.mockResolvedValue([dueItem]);
      mockPrisma.lead.findUnique.mockResolvedValue({
        uuid: LEAD_UUID,
        userUuid: USER_UUID,
        phone: '+919876543210',
        user: { fullName: 'Rahul', profile: { phone: '+919876543210' } },
        distributor: { distributorCode: 'RAJ123' },
      });
      mockPrisma.funnelProgress.findFirst.mockResolvedValue({ uuid: 'fp-1' });
      mockPrisma.followupQueue.updateMany.mockResolvedValue({ count: 1 });

      await service.sendPendingFollowups();

      expect(mockPrisma.followupQueue.updateMany).toHaveBeenCalledWith({
        where: {
          leadUuid: LEAD_UUID,
          status: QueueStatus.PENDING,
        },
        data: { status: QueueStatus.CANCELLED },
      });
      expect(mockWhatsApp.sendMessage).not.toHaveBeenCalled();
    });

    it('sends WhatsApp for due records and marks SENT', async () => {
      const dueItem = {
        uuid: 'q-1',
        leadUuid: LEAD_UUID,
        templateUuid: 'tpl-1',
        channel: 'WHATSAPP',
      };
      mockPrisma.followupQueue.findMany.mockResolvedValue([dueItem]);
      mockPrisma.lead.findUnique.mockResolvedValue({
        uuid: LEAD_UUID,
        userUuid: USER_UUID,
        phone: '+919876543210',
        user: { fullName: 'Rahul', profile: { phone: '+919876543210' } },
        distributor: { distributorCode: 'RAJ123' },
      });
      mockPrisma.funnelProgress.findFirst.mockResolvedValue(null); // not paid
      mockPrisma.messageTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.followupQueue.update.mockResolvedValue({});

      await service.sendPendingFollowups();

      expect(mockWhatsApp.sendMessage).toHaveBeenCalledWith(
        '+919876543210',
        expect.stringContaining('Hey Rahul'),
      );
      expect(mockPrisma.followupQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: 'q-1' },
          data: expect.objectContaining({ status: QueueStatus.SENT }),
        }),
      );
    });
  });
});
