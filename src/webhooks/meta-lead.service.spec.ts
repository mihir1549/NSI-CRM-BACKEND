import { Test, TestingModule } from '@nestjs/testing';
import { MetaLeadWebhookService } from './meta-lead.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { LeadAlertService } from '../notifications/lead-alert.service';

const mockPrisma = {
  metaLead: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: { findFirst: jest.fn(), findUnique: jest.fn() },
  socialPreference: { findUnique: jest.fn() },
};

const mockWhatsApp = {
  sendMessage: jest.fn(),
};

const mockLeadAlert = {
  notifyNewLeadMeta: jest.fn(),
};

const baseLeadData = {
  fullName: 'Rahul Sharma',
  phone: '+919876543210',
  email: 'rahul@example.com',
  metaLeadgenId: 'leadgen-123',
  metaFormId: 'form-456',
};

describe('MetaLeadWebhookService', () => {
  let service: MetaLeadWebhookService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaLeadWebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsAppService, useValue: mockWhatsApp },
        { provide: LeadAlertService, useValue: mockLeadAlert },
      ],
    }).compile();

    service = module.get<MetaLeadWebhookService>(MetaLeadWebhookService);

    mockLeadAlert.notifyNewLeadMeta.mockResolvedValue(undefined);
    mockWhatsApp.sendMessage.mockResolvedValue(undefined);
  });

  describe('createFromWebhook', () => {
    it('silently rejects duplicate metaLeadgenId', async () => {
      mockPrisma.metaLead.findUnique.mockResolvedValue({ uuid: 'existing' });

      await service.createFromWebhook(baseLeadData);

      expect(mockPrisma.metaLead.create).not.toHaveBeenCalled();
    });

    it('silently rejects duplicate phone', async () => {
      mockPrisma.metaLead.findUnique.mockResolvedValue(null);
      mockPrisma.metaLead.findFirst.mockResolvedValue({ uuid: 'existing' });

      await service.createFromWebhook(baseLeadData);

      expect(mockPrisma.metaLead.create).not.toHaveBeenCalled();
    });

    it('assigns to distributor when referralCode matches', async () => {
      mockPrisma.metaLead.findUnique.mockResolvedValue(null);
      mockPrisma.metaLead.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: 'dist-uuid-1' });
      mockPrisma.metaLead.create.mockResolvedValue({ uuid: 'meta-1' });
      mockPrisma.socialPreference.findUnique.mockResolvedValue(null);

      await service.createFromWebhook({
        ...baseLeadData,
        referralCode: 'RAJ123',
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { distributorCode: 'RAJ123', role: 'DISTRIBUTOR' },
        select: { uuid: true },
      });
      expect(mockPrisma.metaLead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ distributorUuid: 'dist-uuid-1' }),
        }),
      );
    });

    it('assigns distributorUuid=null when no referralCode provided', async () => {
      mockPrisma.metaLead.findUnique.mockResolvedValue(null);
      mockPrisma.metaLead.findFirst.mockResolvedValue(null);
      mockPrisma.metaLead.create.mockResolvedValue({ uuid: 'meta-1' });

      await service.createFromWebhook(baseLeadData); // no referralCode

      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.metaLead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ distributorUuid: null }),
        }),
      );
    });

    it('sends WhatsApp to lead when distributor.autoWhatsApp is enabled', async () => {
      mockPrisma.metaLead.findUnique.mockResolvedValue(null);
      mockPrisma.metaLead.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: 'dist-uuid-1' });
      mockPrisma.metaLead.create.mockResolvedValue({ uuid: 'meta-1' });
      mockPrisma.socialPreference.findUnique.mockResolvedValue({
        autoWhatsApp: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        distributorCode: 'RAJ123',
      });
      mockWhatsApp.sendMessage.mockResolvedValue(undefined);
      mockPrisma.metaLead.update.mockResolvedValue({});

      await service.createFromWebhook({
        ...baseLeadData,
        referralCode: 'RAJ123',
      });

      expect(mockWhatsApp.sendMessage).toHaveBeenCalledWith(
        baseLeadData.phone,
        expect.stringContaining('Hi Rahul Sharma'),
      );
      expect(mockPrisma.metaLead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: 'meta-1' },
          data: expect.objectContaining({ whatsappSentAt: expect.any(Date) }),
        }),
      );
    });

    it('skips WhatsApp when distributor.autoWhatsApp = false', async () => {
      mockPrisma.metaLead.findUnique.mockResolvedValue(null);
      mockPrisma.metaLead.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: 'dist-uuid-1' });
      mockPrisma.metaLead.create.mockResolvedValue({ uuid: 'meta-1' });
      mockPrisma.socialPreference.findUnique.mockResolvedValue({
        autoWhatsApp: false,
      });

      await service.createFromWebhook({
        ...baseLeadData,
        referralCode: 'RAJ123',
      });

      expect(mockWhatsApp.sendMessage).not.toHaveBeenCalled();
      expect(mockPrisma.metaLead.update).not.toHaveBeenCalled();
    });
  });
});
