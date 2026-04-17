import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FunnelService } from './funnel.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeadsService } from '../leads/leads.service';
import { VIDEO_PROVIDER_TOKEN } from '../common/video/video-provider.interface';
import { StepType } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const USER_UUID = '11111111-1111-1111-1111-111111111111';
const STEP_UUID = '22222222-2222-2222-2222-222222222222';
const SECTION_UUID = '33333333-3333-3333-3333-333333333333';
const PROGRESS_UUID = '44444444-4444-4444-4444-444444444444';

const mockProgress = {
  uuid: PROGRESS_UUID,
  userUuid: USER_UUID,
  currentStepUuid: STEP_UUID,
  currentSectionUuid: SECTION_UUID,
  status: 'IN_PROGRESS',
  phoneVerified: false,
  paymentCompleted: false,
  decisionAnswer: null,
  stepProgress: [],
};

const mockStep = {
  uuid: STEP_UUID,
  sectionUuid: SECTION_UUID,
  type: StepType.VIDEO_TEXT,
  order: 1,
  isActive: true,
  content: {
    title: 'Intro Video',
    requireVideoCompletion: false,
    videoDuration: 60,
  },
  phoneGate: null,
  paymentGate: null,
  decisionStep: null,
};

const mockSection = {
  uuid: SECTION_UUID,
  name: 'Section 1',
  description: 'First section',
  order: 1,
  isActive: true,
  steps: [mockStep],
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  funnelSection: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  funnelStep: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  funnelProgress: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stepProgress: {
    upsert: jest.fn(),
  },
  userAcquisition: {
    findUnique: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

const mockLeadsService = {
  onDecisionYes: jest.fn().mockResolvedValue(undefined),
  onDecisionNo: jest.fn().mockResolvedValue(undefined),
};

const mockVideoProvider = {
  getVideoAnalytics: jest.fn(),
  getVideoHeatmap: jest.fn(),
  getSignedUrl: jest.fn().mockReturnValue('https://signed.url'),
};

describe('FunnelService', () => {
  let service: FunnelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FunnelService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LeadsService, useValue: mockLeadsService },
        { provide: VIDEO_PROVIDER_TOKEN, useValue: mockVideoProvider },
      ],
    }).compile();

    service = module.get<FunnelService>(FunnelService);
    jest.clearAllMocks();

    // Safe defaults
    mockPrisma.funnelProgress.findUnique.mockResolvedValue(mockProgress);
    mockPrisma.funnelProgress.create.mockResolvedValue(mockProgress);
    mockPrisma.funnelProgress.update.mockResolvedValue({});
    mockPrisma.stepProgress.upsert.mockResolvedValue({});
    mockPrisma.funnelStep.findFirst.mockResolvedValue(null); // no next step
    mockPrisma.funnelSection.findUnique.mockResolvedValue(mockSection);
    mockPrisma.funnelSection.findFirst.mockResolvedValue(null);
    mockPrisma.userAcquisition.findUnique.mockResolvedValue(null);
  });

  // ══════════════════════════════════════════════════════════
  // getStructure()
  // ══════════════════════════════════════════════════════════
  describe('getStructure()', () => {
    it('returns sections with steps and titles', async () => {
      mockPrisma.funnelSection.findMany.mockResolvedValue([mockSection]);

      const result = await service.getStructure();

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].uuid).toBe(SECTION_UUID);
      expect(result.sections[0].steps[0].uuid).toBe(STEP_UUID);
      expect(result.sections[0].steps[0].title).toBe('Intro Video');
    });

    it('returns empty sections when no active sections', async () => {
      mockPrisma.funnelSection.findMany.mockResolvedValue([]);

      const result = await service.getStructure();

      expect(result.sections).toHaveLength(0);
    });

    it('resolves PHONE_GATE title', async () => {
      const phoneSection = {
        ...mockSection,
        steps: [
          {
            ...mockStep,
            type: StepType.PHONE_GATE,
            content: null,
            phoneGate: { title: 'Verify Phone' },
          },
        ],
      };
      mockPrisma.funnelSection.findMany.mockResolvedValue([phoneSection]);

      const result = await service.getStructure();

      expect(result.sections[0].steps[0].title).toBe('Verify Phone');
    });
  });

  // ══════════════════════════════════════════════════════════
  // getProgress()
  // ══════════════════════════════════════════════════════════
  describe('getProgress()', () => {
    it('returns current progress for user', async () => {
      const result = await service.getProgress(USER_UUID);

      expect(result.currentStepUuid).toBe(STEP_UUID);
      expect(result.phoneVerified).toBe(false);
      expect(result.completedStepUuids).toEqual([]);
    });

    it('creates progress if not exists', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue(null);
      mockPrisma.funnelSection.findFirst.mockResolvedValue({
        ...mockSection,
        steps: [mockStep],
      });
      mockPrisma.funnelProgress.create.mockResolvedValue({
        ...mockProgress,
        currentStepUuid: STEP_UUID,
        stepProgress: [],
      });

      const result = await service.getProgress(USER_UUID);

      expect(result.currentStepUuid).toBe(STEP_UUID);
      expect(mockPrisma.funnelProgress.create).toHaveBeenCalled();
    });

    it('includes completed step UUIDs in response', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockProgress,
        stepProgress: [{ stepUuid: STEP_UUID, isCompleted: true }],
      });

      const result = await service.getProgress(USER_UUID);

      expect(result.completedStepUuids).toContain(STEP_UUID);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getStep()
  // ══════════════════════════════════════════════════════════
  describe('getStep()', () => {
    it('returns VIDEO_TEXT step content for current step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockStep);

      const result = await service.getStep(USER_UUID, STEP_UUID);

      expect(result.type).toBe(StepType.VIDEO_TEXT);
      expect((result as any).content).toBeDefined();
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(service.getStep(USER_UUID, STEP_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when step is inactive', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...mockStep,
        isActive: false,
      });

      await expect(service.getStep(USER_UUID, STEP_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when step is not current and not completed', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockStep);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockProgress,
        currentStepUuid: 'other-step-uuid',
        stepProgress: [],
      });

      await expect(service.getStep(USER_UUID, STEP_UUID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns PAYMENT_GATE step content with parsed rich content', async () => {
      const richContent = {
        subheading: 'Sub',
        ctaText: 'Pay Now',
        features: ['A'],
        trustBadges: [],
        testimonials: [],
      };
      const paymentStep = {
        ...mockStep,
        type: StepType.PAYMENT_GATE,
        content: null,
        paymentGate: {
          title: 'Pay',
          subtitle: JSON.stringify(richContent),
          amount: 999,
          currency: 'INR',
          allowCoupons: true,
          isActive: true,
        },
      };
      mockPrisma.funnelStep.findUnique.mockResolvedValue(paymentStep);

      const result = await service.getStep(USER_UUID, STEP_UUID);

      expect(result.type).toBe(StepType.PAYMENT_GATE);
      expect((result as any).paymentGate.ctaText).toBe('Pay Now');
    });

    it('returns DECISION step with decisionStep data', async () => {
      const decisionStep = {
        ...mockStep,
        type: StepType.DECISION,
        decisionStep: { uuid: 'ds-1', question: 'Are you in?' },
      };
      mockPrisma.funnelStep.findUnique.mockResolvedValue(decisionStep);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockProgress,
        stepProgress: [{ stepUuid: STEP_UUID, isCompleted: false }],
      });

      const result = await service.getStep(USER_UUID, STEP_UUID);

      expect(result.type).toBe(StepType.DECISION);
    });
  });

  // ══════════════════════════════════════════════════════════
  // completeStep()
  // ══════════════════════════════════════════════════════════
  describe('completeStep()', () => {
    const dto = { watchedSeconds: 60 };

    it('completes the current step and advances progress', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockStep);

      const result = await service.completeStep(
        USER_UUID,
        STEP_UUID,
        dto as any,
        '127.0.0.1',
      );

      expect(result.ok).toBe(true);
      expect(mockPrisma.stepProgress.upsert).toHaveBeenCalled();
      expect(mockPrisma.funnelProgress.update).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FUNNEL_STEP_COMPLETED' }),
      );
    });

    it('returns already completed silently if step was already completed', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockStep);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockProgress,
        stepProgress: [{ stepUuid: STEP_UUID, isCompleted: true }],
      });

      const result = await service.completeStep(
        USER_UUID,
        STEP_UUID,
        dto as any,
        '127.0.0.1',
      );

      expect(result).toEqual({ ok: true, message: 'Step already completed' });
      expect(mockPrisma.stepProgress.upsert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(
        service.completeStep(USER_UUID, STEP_UUID, dto as any, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when completing non-current step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockStep);
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockProgress,
        currentStepUuid: 'different-step',
        stepProgress: [],
      });

      await expect(
        service.completeStep(USER_UUID, STEP_UUID, dto as any, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when video not fully watched (requireVideoCompletion)', async () => {
      const strictVideoStep = {
        ...mockStep,
        content: {
          ...mockStep.content,
          requireVideoCompletion: true,
          videoDuration: 100,
        },
      };
      mockPrisma.funnelStep.findUnique.mockResolvedValue(strictVideoStep);

      await expect(
        service.completeStep(
          USER_UUID,
          STEP_UUID,
          { watchedSeconds: 50 } as any,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets status COMPLETED and currentStepUuid null when no next step', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockStep);
      mockPrisma.funnelStep.findFirst.mockResolvedValue(null);

      await service.completeStep(USER_UUID, STEP_UUID, dto as any, '127.0.0.1');

      expect(mockPrisma.funnelProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            currentStepUuid: null,
          }),
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // saveVideoProgress()
  // ══════════════════════════════════════════════════════════
  describe('saveVideoProgress()', () => {
    it('saves video progress and updates lastSeenAt', async () => {
      const result = await service.saveVideoProgress(USER_UUID, STEP_UUID, 45);

      expect(result.ok).toBe(true);
      expect(mockPrisma.stepProgress.upsert).toHaveBeenCalled();
      expect(mockPrisma.funnelProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
        }),
      );
    });

    it('does not decrease already-saved watched seconds', async () => {
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockProgress,
        stepProgress: [
          { stepUuid: STEP_UUID, isCompleted: false, watchedSeconds: 80 },
        ],
      });

      await service.saveVideoProgress(USER_UUID, STEP_UUID, 30);

      expect(mockPrisma.stepProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ watchedSeconds: 80 }), // Math.max(30, 80)
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // recordDecision()
  // ══════════════════════════════════════════════════════════
  describe('recordDecision()', () => {
    const dtoYes = { stepUuid: STEP_UUID, answer: 'YES' };
    const dtoNo = { stepUuid: STEP_UUID, answer: 'NO' };

    it('records YES decision, updates progress, fires onDecisionYes', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...mockStep,
        type: StepType.DECISION,
      });

      const result = await service.recordDecision(
        USER_UUID,
        dtoYes as any,
        '127.0.0.1',
      );

      expect(result.ok).toBe(true);
      expect(mockPrisma.funnelProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ decisionAnswer: 'YES' }),
        }),
      );
      expect(mockLeadsService.onDecisionYes).toHaveBeenCalledWith(USER_UUID);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DECISION_YES' }),
      );
    });

    it('records NO decision and fires onDecisionNo', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...mockStep,
        type: StepType.DECISION,
      });

      const result = await service.recordDecision(
        USER_UUID,
        dtoNo as any,
        '127.0.0.1',
      );

      expect(result.ok).toBe(true);
      expect(mockLeadsService.onDecisionNo).toHaveBeenCalledWith(USER_UUID);
    });

    it('throws BadRequestException when step is not a DECISION type', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(mockStep); // VIDEO_TEXT

      await expect(
        service.recordDecision(USER_UUID, dtoYes as any, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when step not found', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue(null);

      await expect(
        service.recordDecision(USER_UUID, dtoYes as any, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if decision already recorded', async () => {
      mockPrisma.funnelStep.findUnique.mockResolvedValue({
        ...mockStep,
        type: StepType.DECISION,
      });
      mockPrisma.funnelProgress.findUnique.mockResolvedValue({
        ...mockProgress,
        decisionAnswer: 'YES', // already set
      });

      await expect(
        service.recordDecision(USER_UUID, dtoYes as any, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
