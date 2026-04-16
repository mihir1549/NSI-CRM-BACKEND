import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StepType } from '@prisma/client';
import { FunnelCmsService } from './funnel-cms.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const SECTION_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STEP_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const DISTRIBUTOR_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const mockSection = {
  uuid: SECTION_UUID,
  name: 'Intro Section',
  description: 'Welcome section',
  order: 1,
  isActive: true,
};

const makeStep = (type: StepType, extra: Record<string, unknown> = {}) => ({
  uuid: STEP_UUID,
  sectionUuid: SECTION_UUID,
  type,
  order: 1,
  isActive: true,
  content:
    type === StepType.VIDEO_TEXT
      ? {
          title: 'Video',
          description: null,
          videoUrl: null,
          videoDuration: null,
          thumbnailUrl: null,
          textContent: null,
          requireVideoCompletion: true,
        }
      : null,
  phoneGate:
    type === StepType.PHONE_GATE
      ? { title: 'Verify Phone', subtitle: null, isActive: true }
      : null,
  paymentGate:
    type === StepType.PAYMENT_GATE
      ? {
          title: 'Buy Now',
          subtitle: JSON.stringify({
            subheading: 'Pay to continue',
            ctaText: 'Pay',
            features: [],
            trustBadges: [],
            testimonials: [],
          }),
          amount: 5000,
          currency: 'INR',
          allowCoupons: false,
          isActive: true,
        }
      : null,
  decisionStep:
    type === StepType.DECISION
      ? {
          question: 'Are you interested?',
          yesLabel: 'Yes',
          noLabel: 'No',
          yesSubtext: null,
          noSubtext: null,
        }
      : null,
  progress: [],
  section: { name: 'Intro Section' },
  ...extra,
});

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  funnelSection: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  funnelStep: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  funnelProgress: {
    count: jest.fn(),
  },
  stepContent: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  phoneGateConfig: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  paymentGateConfig: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  decisionStepConfig: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  userAcquisition: {
    groupBy: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
};

describe('FunnelCmsService', () => {
  let service: FunnelCmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FunnelCmsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FunnelCmsService>(FunnelCmsService);
    jest.clearAllMocks();

    // Safe defaults
    mockPrisma.funnelSection.findUnique.mockResolvedValue(mockSection);
    mockPrisma.funnelSection.findMany.mockResolvedValue([]);
    mockPrisma.funnelSection.create.mockResolvedValue(mockSection);
    mockPrisma.funnelSection.update.mockResolvedValue(mockSection);
    mockPrisma.funnelSection.delete.mockResolvedValue(mockSection);
    mockPrisma.funnelStep.findUnique.mockResolvedValue(
      makeStep(StepType.VIDEO_TEXT),
    );
    mockPrisma.funnelStep.findMany.mockResolvedValue([]);
    mockPrisma.funnelStep.create.mockResolvedValue({ uuid: STEP_UUID });
    mockPrisma.funnelStep.update.mockResolvedValue(
      makeStep(StepType.VIDEO_TEXT),
    );
    mockPrisma.funnelStep.delete.mockResolvedValue({});
    mockPrisma.funnelProgress.count.mockResolvedValue(0);
    mockPrisma.stepContent.create.mockResolvedValue({});
    mockPrisma.stepContent.upsert.mockResolvedValue({});
    mockPrisma.phoneGateConfig.create.mockResolvedValue({});
    mockPrisma.phoneGateConfig.upsert.mockResolvedValue({});
    mockPrisma.paymentGateConfig.create.mockResolvedValue({});
    mockPrisma.paymentGateConfig.upsert.mockResolvedValue({});
    mockPrisma.decisionStepConfig.create.mockResolvedValue({});
    mockPrisma.decisionStepConfig.upsert.mockResolvedValue({});
    mockPrisma.userAcquisition.groupBy.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
  });

  // ══════════════════════════════════════════════════════════
  // createSection()
  // ══════════════════════════════════════════════════════════
  describe('createSection()', () => {
    it('creates a section successfully', async () => {
      const dto = { name: 'New Section', description: 'Desc', order: 1 };

      const result = await service.createSection(dto as any);

      expect(mockPrisma.funnelSection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'New Section', order: 1 }),
        }),
      );
      expect(result.uuid).toBe(SECTION_UUID);
    });

    it('creates a section with null description when not provided', async () => {
      const dto = { name: 'Section', order: 2 };

      await service.createSection(dto as any);

      expect(mockPrisma.funnelSection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: null }),
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // getAllSections()
  // ══════════════════════════════════════════════════════════
  describe('getAllSections()', () => {
    it('returns all sections ordered by order asc', async () => {
      mockPrisma.funnelSection.findMany.mockResolvedValue([mockSection]);

      const result = await service.getAllSections();

      expect(result).toHaveLength(1);
      expect(mockPrisma.funnelSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { order: 'asc' } }),
      );
    });

    it('returns empty array when no sections', async () => {
      const result = await service.getAllSections();

      expect(result).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateSection()
  // ══════════════════════════════════════════════════════════
  describe('updateSection()', () => {
    it('updates section fields successfully', async () => {
      const dto = { name: 'Updated Section', isActive: false };

      const result = await service.updateSection(SECTION_UUID, dto as any);

      expect(mockPrisma.funnelSection.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uuid: SECTION_UUID } }),
      );
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.funnelSection.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSection(SECTION_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getSectionForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('getSectionForUpdate()', () => {
    it('returns section editable fields', async () => {
      const result = await service.getSectionForUpdate(SECTION_UUID);

      expect(result.name).toBe('Intro Section');
      expect(result.order).toBe(1);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.funnelSection.findUnique.mockResolvedValue(null);

      await expect(service.getSectionForUpdate(SECTION_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteSection()
  // ══════════════════════════════════════════════════════════
  describe('deleteSection()', () => {
    it('deletes section when no users on it', async () => {
      mockPrisma.funnelProgress.count.mockResolvedValue(0);

      const result = await service.deleteSection(SECTION_UUID);

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.funnelSection.delete).toHaveBeenCalledWith({
        where: { uuid: SECTION_UUID },
      });
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.funnelSection.findUnique.mockResolvedValue(null);

      await expect(service.deleteSection(SECTION_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when users are on the section', async () => {
      mockPrisma.funnelProgress.count.mockResolvedValue(3);

      await expect(service.deleteSection(SECTION_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // reorderSections()
  // ══════════════════════════════════════════════════════════
  describe('reorderSections()', () => {
    it('reorders sections and returns ok', async () => {
      const items = [
        { uuid: SECTION_UUID, order: 2 },
        { uuid: 'other-uuid', order: 1 },
      ];

      const result = await service.reorderSections(items as any);

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.funnelSection.update).toHaveBeenCalledTimes(2);
    });

    it('returns ok with empty items array', async () => {
      const result = await service.reorderSections([]);

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.funnelSection.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // createStep()
  // ══════════════════════════════════════════════════════════
  describe('createStep()', () => {
    it('creates a VIDEO_TEXT step and its content', async () => {
      const dto = {
        sectionUuid: SECTION_UUID,
        type: StepType.VIDEO_TEXT,
        order: 1,
      };
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.VIDEO_TEXT),
      );

      await service.createStep(dto as any);

      expect(mockPrisma.funnelStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: StepType.VIDEO_TEXT }),
        }),
      );
      expect(mockPrisma.stepContent.create).toHaveBeenCalled();
    });

    it('creates a PHONE_GATE step and its config', async () => {
      const dto = {
        sectionUuid: SECTION_UUID,
        type: StepType.PHONE_GATE,
        order: 2,
      };
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PHONE_GATE),
      );

      await service.createStep(dto as any);

      expect(mockPrisma.phoneGateConfig.create).toHaveBeenCalled();
    });

    it('creates a PAYMENT_GATE step and its config', async () => {
      const dto = {
        sectionUuid: SECTION_UUID,
        type: StepType.PAYMENT_GATE,
        order: 3,
      };
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PAYMENT_GATE),
      );

      await service.createStep(dto as any);

      expect(mockPrisma.paymentGateConfig.create).toHaveBeenCalled();
    });

    it('creates a DECISION step and its config', async () => {
      const dto = {
        sectionUuid: SECTION_UUID,
        type: StepType.DECISION,
        order: 4,
      };
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.DECISION),
      );

      await service.createStep(dto as any);

      expect(mockPrisma.decisionStepConfig.create).toHaveBeenCalled();
    });

    it('throws NotFoundException when section not found', async () => {
      mockPrisma.funnelSection.findUnique.mockResolvedValue(null);

      await expect(
        service.createStep({
          sectionUuid: SECTION_UUID,
          type: StepType.VIDEO_TEXT,
          order: 1,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getStepById()
  // ══════════════════════════════════════════════════════════
  describe('getStepById()', () => {
    it('returns step with all relations', async () => {
      const result = await service.getStepById(STEP_UUID);

      expect(result.uuid).toBe(STEP_UUID);
      expect(result.type).toBe(StepType.VIDEO_TEXT);
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(service.getStepById(STEP_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateStep()
  // ══════════════════════════════════════════════════════════
  describe('updateStep()', () => {
    it('updates step order and isActive', async () => {
      const dto = { order: 2, isActive: false };

      await service.updateStep(STEP_UUID, dto as any);

      expect(mockPrisma.funnelStep.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uuid: STEP_UUID } }),
      );
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(service.updateStep(STEP_UUID, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // getStepForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('getStepForUpdate()', () => {
    it('returns step editable fields', async () => {
      const result = await service.getStepForUpdate(STEP_UUID);

      expect(result.order).toBe(1);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(service.getStepForUpdate(STEP_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteStep()
  // ══════════════════════════════════════════════════════════
  describe('deleteStep()', () => {
    it('deletes step when no users on it', async () => {
      mockPrisma.funnelProgress.count.mockResolvedValue(0);

      const result = await service.deleteStep(STEP_UUID);

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.funnelStep.delete).toHaveBeenCalledWith({
        where: { uuid: STEP_UUID },
      });
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(service.deleteStep(STEP_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when users are on the step', async () => {
      mockPrisma.funnelProgress.count.mockResolvedValue(5);

      await expect(service.deleteStep(STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // reorderSteps()
  // ══════════════════════════════════════════════════════════
  describe('reorderSteps()', () => {
    it('reorders steps and returns ok', async () => {
      const items = [{ uuid: STEP_UUID, order: 2 }];

      const result = await service.reorderSteps(items as any);

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.funnelStep.update).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════
  // upsertStepContent()
  // ══════════════════════════════════════════════════════════
  describe('upsertStepContent()', () => {
    it('upserts content for a VIDEO_TEXT step', async () => {
      const dto = {
        title: 'Updated Title',
        videoUrl: 'https://example.com/video.mp4',
      };

      await service.upsertStepContent(STEP_UUID, dto as any);

      expect(mockPrisma.stepContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stepUuid: STEP_UUID } }),
      );
    });

    it('throws BadRequestException for non-VIDEO_TEXT step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PHONE_GATE),
      );

      await expect(
        service.upsertStepContent(STEP_UUID, { title: 'Title' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertStepContent(STEP_UUID, { title: 'Title' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getStepContentForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('getStepContentForUpdate()', () => {
    it('returns content fields for VIDEO_TEXT step', async () => {
      const result = await service.getStepContentForUpdate(STEP_UUID);

      expect(result.title).toBe('Video');
      expect(result.requireVideoCompletion).toBe(true);
    });

    it('throws BadRequestException for non-VIDEO_TEXT step without content', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PHONE_GATE),
      );

      await expect(service.getStepContentForUpdate(STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for VIDEO_TEXT step with null content', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...makeStep(StepType.VIDEO_TEXT),
        content: null,
      });

      await expect(service.getStepContentForUpdate(STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // upsertPhoneGate()
  // ══════════════════════════════════════════════════════════
  describe('upsertPhoneGate()', () => {
    it('upserts phone gate config for PHONE_GATE step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PHONE_GATE),
      );
      const dto = { title: 'Verify your number', isActive: true };

      await service.upsertPhoneGate(STEP_UUID, dto as any);

      expect(mockPrisma.phoneGateConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stepUuid: STEP_UUID } }),
      );
    });

    it('throws BadRequestException for non-PHONE_GATE step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.VIDEO_TEXT),
      );

      await expect(
        service.upsertPhoneGate(STEP_UUID, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertPhoneGate(STEP_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getPhoneGateForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('getPhoneGateForUpdate()', () => {
    it('returns phone gate fields for PHONE_GATE step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PHONE_GATE),
      );

      const result = await service.getPhoneGateForUpdate(STEP_UUID);

      expect(result.title).toBe('Verify Phone');
      expect(result.isActive).toBe(true);
    });

    it('throws BadRequestException when step is not PHONE_GATE', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.VIDEO_TEXT),
      );

      await expect(service.getPhoneGateForUpdate(STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when phoneGate config is null', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...makeStep(StepType.PHONE_GATE),
        phoneGate: null,
      });

      await expect(service.getPhoneGateForUpdate(STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // upsertPaymentGate()
  // ══════════════════════════════════════════════════════════
  describe('upsertPaymentGate()', () => {
    it('upserts payment gate for PAYMENT_GATE step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PAYMENT_GATE),
      );
      const dto = {
        heading: 'Buy Now',
        amount: 4999,
        currency: 'INR',
        allowCoupons: false,
        enabled: true,
      };

      await service.upsertPaymentGate(STEP_UUID, dto as any);

      expect(mockPrisma.paymentGateConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stepUuid: STEP_UUID } }),
      );
    });

    it('throws BadRequestException for non-PAYMENT_GATE step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.DECISION),
      );

      await expect(
        service.upsertPaymentGate(STEP_UUID, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertPaymentGate(STEP_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getPaymentGateForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('getPaymentGateForUpdate()', () => {
    it('returns payment gate fields with parsed rich content', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PAYMENT_GATE),
      );

      const result = await service.getPaymentGateForUpdate(STEP_UUID);

      expect(result.heading).toBe('Buy Now');
      expect(result.amount).toBe(5000);
      expect(result.subheading).toBe('Pay to continue');
      expect(result.features).toEqual([]);
    });

    it('handles malformed subtitle JSON gracefully', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...makeStep(StepType.PAYMENT_GATE),
        paymentGate: {
          title: 'Old Title',
          subtitle: 'not-json', // old plain text subtitle
          amount: 1000,
          currency: 'INR',
          allowCoupons: true,
          isActive: true,
        },
      });

      const result = await service.getPaymentGateForUpdate(STEP_UUID);

      expect(result.heading).toBe('Old Title');
      expect(result.subheading).toBe('not-json');
      expect(result.features).toEqual([]);
    });

    it('throws BadRequestException for non-PAYMENT_GATE step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.VIDEO_TEXT),
      );

      await expect(service.getPaymentGateForUpdate(STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // upsertDecisionStep()
  // ══════════════════════════════════════════════════════════
  describe('upsertDecisionStep()', () => {
    it('upserts decision config for DECISION step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.DECISION),
      );
      const dto = {
        question: 'Are you interested?',
        yesLabel: 'Yes!',
        noLabel: 'No',
      };

      await service.upsertDecisionStep(STEP_UUID, dto as any);

      expect(mockPrisma.decisionStepConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stepUuid: STEP_UUID } }),
      );
    });

    it('throws BadRequestException for non-DECISION step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.VIDEO_TEXT),
      );

      await expect(
        service.upsertDecisionStep(STEP_UUID, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertDecisionStep(STEP_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDecisionStepForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('getDecisionStepForUpdate()', () => {
    it('returns decision step fields', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.DECISION),
      );

      const result = await service.getDecisionStepForUpdate(STEP_UUID);

      expect(result.question).toBe('Are you interested?');
      expect(result.yesLabel).toBe('Yes');
      expect(result.noLabel).toBe('No');
    });

    it('throws BadRequestException when step is not DECISION', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(
        makeStep(StepType.PHONE_GATE),
      );

      await expect(service.getDecisionStepForUpdate(STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when decisionStep config is null', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...makeStep(StepType.DECISION),
        decisionStep: null,
      });

      await expect(service.getDecisionStepForUpdate(STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // getFunnelAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getFunnelAnalytics()', () => {
    it('returns empty array when no active steps', async () => {
      const result = await service.getFunnelAnalytics();

      expect(result).toHaveLength(0);
    });

    it('computes drop-off stats for steps with progress', async () => {
      const step = {
        ...makeStep(StepType.VIDEO_TEXT),
        progress: [
          { isCompleted: true },
          { isCompleted: false },
          { isCompleted: true },
        ],
      };
      mockPrisma.funnelStep.findMany.mockResolvedValue([step]);

      const result = await service.getFunnelAnalytics();

      expect(result).toHaveLength(1);
      expect(result[0].totalReached).toBe(3);
      expect(result[0].totalCompleted).toBe(2);
      expect(result[0].dropOffCount).toBe(1);
      expect(result[0].dropOffRate).toBeCloseTo(33.33);
    });

    it('uses step content title for VIDEO_TEXT steps', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([
        makeStep(StepType.VIDEO_TEXT),
      ]);

      const result = await service.getFunnelAnalytics();

      expect(result[0].stepTitle).toBe('Video');
    });

    it('uses phone gate title for PHONE_GATE steps', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([
        makeStep(StepType.PHONE_GATE),
      ]);

      const result = await service.getFunnelAnalytics();

      expect(result[0].stepTitle).toBe('Verify Phone');
    });

    it('uses payment gate title for PAYMENT_GATE steps', async () => {
      mockPrisma.funnelStep.findMany.mockResolvedValue([
        makeStep(StepType.PAYMENT_GATE),
      ]);

      const result = await service.getFunnelAnalytics();

      expect(result[0].stepTitle).toBe('Buy Now');
    });
  });

  // ══════════════════════════════════════════════════════════
  // getUtmAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getUtmAnalytics()', () => {
    it('returns empty arrays when no acquisition data', async () => {
      const result = await service.getUtmAnalytics();

      expect(result.bySource).toHaveLength(0);
      expect(result.byMedium).toHaveLength(0);
      expect(result.byCampaign).toHaveLength(0);
      expect(result.byDistributor).toHaveLength(0);
    });

    it('maps groupBy results to correct format', async () => {
      mockPrisma.userAcquisition.groupBy
        .mockResolvedValueOnce([
          { utmSource: 'facebook', _count: { utmSource: 5 } },
        ])
        .mockResolvedValueOnce([
          { utmMedium: 'social', _count: { utmMedium: 3 } },
        ])
        .mockResolvedValueOnce([
          { utmCampaign: 'summer', _count: { utmCampaign: 2 } },
        ])
        .mockResolvedValueOnce([
          {
            distributorCode: 'NSI-RAH01',
            distributorUuid: DISTRIBUTOR_UUID,
            _count: { distributorCode: 4 },
          },
        ]);

      const result = await service.getUtmAnalytics();

      expect(result.bySource[0].utmSource).toBe('facebook');
      expect(result.bySource[0].count).toBe(5);
      expect(result.byMedium[0].utmMedium).toBe('social');
      expect(result.byCampaign[0].utmCampaign).toBe('summer');
      expect(result.byDistributor[0].distributorCode).toBe('NSI-RAH01');
    });
  });

  // ══════════════════════════════════════════════════════════
  // getDeviceAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getDeviceAnalytics()', () => {
    it('returns device and country breakdown', async () => {
      mockPrisma.userAcquisition.groupBy
        .mockResolvedValueOnce([
          { deviceType: 'mobile', _count: { deviceType: 10 } },
        ])
        .mockResolvedValueOnce([{ country: 'IN', _count: { country: 8 } }]);

      const result = await service.getDeviceAnalytics();

      expect(result.byDevice[0].deviceType).toBe('mobile');
      expect(result.byDevice[0].count).toBe(10);
      expect(result.byCountry[0].country).toBe('IN');
      expect(result.byCountry[0].count).toBe(8);
    });

    it('returns empty arrays when no data', async () => {
      const result = await service.getDeviceAnalytics();

      expect(result.byDevice).toHaveLength(0);
      expect(result.byCountry).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getConversionAnalytics()
  // ══════════════════════════════════════════════════════════
  describe('getConversionAnalytics()', () => {
    it('returns zeros when no users', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.funnelProgress.count.mockResolvedValue(0);

      const result = await service.getConversionAnalytics();

      expect(result.totalRegistered).toBe(0);
      expect(result.phoneVerifyRate).toBe(0);
      expect(result.paymentRate).toBe(0);
      expect(result.yesRate).toBe(0);
    });

    it('calculates conversion rates correctly', async () => {
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.funnelProgress.count
        .mockResolvedValueOnce(50) // phoneVerified
        .mockResolvedValueOnce(25) // paymentCompleted
        .mockResolvedValueOnce(20) // reachedDecision
        .mockResolvedValueOnce(15) // YES
        .mockResolvedValueOnce(5); // NO

      const result = await service.getConversionAnalytics();

      expect(result.totalRegistered).toBe(100);
      expect(result.totalPhoneVerified).toBe(50);
      expect(result.phoneVerifyRate).toBe(50); // 50/100
      expect(result.paymentRate).toBe(50); // 25/50
      expect(result.decisionRate).toBe(80); // 20/25
      expect(result.yesRate).toBe(75); // 15/20
      expect(result.totalYes).toBe(15);
      expect(result.totalNo).toBe(5);
    });
  });
});
