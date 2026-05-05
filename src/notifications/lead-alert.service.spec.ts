import { Test, TestingModule } from '@nestjs/testing';
import { LeadAlertService } from './lead-alert.service';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { SseService } from '../sse/sse.service';

const LEAD_UUID = 'lead-uuid-1';
const DIST_UUID = 'dist-uuid-1';
const SUPER_ADMIN_UUID = 'sa-uuid-1';

const mockLead = {
  uuid: LEAD_UUID,
  userUuid: 'user-uuid-1',
  distributorUuid: DIST_UUID,
  phone: '+919876543210',
  status: 'NEW',
  user: { fullName: 'Rahul Sharma', phone: '+919876543210' },
};

const mockPrisma = {
  lead: { findUnique: jest.fn() },
  metaLead: { findUnique: jest.fn() },
  socialPreference: { findUnique: jest.fn() },
  user: { findFirst: jest.fn(), findUnique: jest.fn() },
  userProfile: { findUnique: jest.fn() },
};

const mockWhatsApp = {
  sendMessage: jest.fn(),
};

const mockSse = {
  sendToUser: jest.fn(),
};

describe('LeadAlertService', () => {
  let service: LeadAlertService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadAlertService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsAppService, useValue: mockWhatsApp },
        { provide: SseService, useValue: mockSse },
      ],
    }).compile();

    service = module.get<LeadAlertService>(LeadAlertService);
  });

  // ── notifyNewLead ────────────────────────────────────────────────────────

  describe('notifyNewLead', () => {
    it('skips notification when source MANUAL is not in notifyOnSources', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
      mockPrisma.socialPreference.findUnique.mockResolvedValue({
        notifyOnSources: ['META_LEAD_FORM'], // does NOT include MANUAL
      });

      await service.notifyNewLead(LEAD_UUID, DIST_UUID);

      expect(mockWhatsApp.sendMessage).not.toHaveBeenCalled();
      expect(mockSse.sendToUser).not.toHaveBeenCalled();
    });

    it('sends WhatsApp + SSE when notifyOnSources is empty (default = all)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
      mockPrisma.socialPreference.findUnique.mockResolvedValue({
        notifyOnSources: [],
      });
      mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Distributor' });
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        phone: '+911111111111',
      });
      mockWhatsApp.sendMessage.mockResolvedValue(undefined);

      await service.notifyNewLead(LEAD_UUID, DIST_UUID);

      expect(mockWhatsApp.sendMessage).toHaveBeenCalledWith(
        '+911111111111',
        expect.stringContaining('New lead assigned'),
      );
      expect(mockSse.sendToUser).toHaveBeenCalledWith(
        DIST_UUID,
        expect.objectContaining({
          type: 'notification',
          data: expect.objectContaining({ type: 'NEW_LEAD' }),
        }),
      );
    });

    it('notifies Super Admin when no distributor is assigned', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        distributorUuid: null,
      });
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: SUPER_ADMIN_UUID });
      mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Super Admin' });
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        phone: '+912222222222',
      });
      mockWhatsApp.sendMessage.mockResolvedValue(undefined);

      await service.notifyNewLead(LEAD_UUID, null);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { role: 'SUPER_ADMIN' },
        select: { uuid: true },
      });
      expect(mockSse.sendToUser).toHaveBeenCalledWith(
        SUPER_ADMIN_UUID,
        expect.any(Object),
      );
    });
  });

  // ── notifyLeadHot ────────────────────────────────────────────────────────

  describe('notifyLeadHot', () => {
    it('sends to distributor when assigned', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        phone: '+911111111111',
      });
      mockWhatsApp.sendMessage.mockResolvedValue(undefined);

      await service.notifyLeadHot(LEAD_UUID, DIST_UUID);

      expect(mockWhatsApp.sendMessage).toHaveBeenCalledWith(
        '+911111111111',
        expect.stringContaining('Your lead'),
      );
      expect(mockSse.sendToUser).toHaveBeenCalledWith(
        DIST_UUID,
        expect.objectContaining({
          type: 'notification',
          data: expect.objectContaining({ type: 'LEAD_HOT' }),
        }),
      );
    });

    it('sends to Super Admin when unassigned', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        distributorUuid: null,
      });
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: SUPER_ADMIN_UUID });
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        phone: '+912222222222',
      });
      mockWhatsApp.sendMessage.mockResolvedValue(undefined);

      await service.notifyLeadHot(LEAD_UUID, null);

      expect(mockWhatsApp.sendMessage).toHaveBeenCalledWith(
        '+912222222222',
        expect.stringContaining('Unassigned lead'),
      );
      expect(mockSse.sendToUser).toHaveBeenCalledWith(
        SUPER_ADMIN_UUID,
        expect.any(Object),
      );
    });

    it('does not throw when WhatsApp send fails (fire-and-forget)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        phone: '+911111111111',
      });
      mockWhatsApp.sendMessage.mockRejectedValue(new Error('Twilio down'));

      await expect(
        service.notifyLeadHot(LEAD_UUID, DIST_UUID),
      ).resolves.not.toThrow();
    });
  });
});
