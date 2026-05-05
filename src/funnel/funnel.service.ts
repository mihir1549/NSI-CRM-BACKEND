import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { VIDEO_PROVIDER_TOKEN, IVideoProvider } from '../common/video/video-provider.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LeadsService } from '../leads/leads.service.js';
import { DropoffQueueService } from '../queue/dropoff-queue.service.js';
import { StepType } from '@prisma/client';
import type { CompleteStepDto } from './dto/complete-step.dto.js';
import type { DecisionDto } from './dto/decision.dto.js';

export interface FunnelStructureStep {
  uuid: string;
  type: StepType;
  order: number;
  isActive: boolean;
  title: string;
}

export interface FunnelStructureSection {
  uuid: string;
  name: string;
  description: string | null;
  order: number;
  steps: FunnelStructureStep[];
}

export interface FunnelStructureResult {
  sections: FunnelStructureSection[];
}

@Injectable()
export class FunnelService {
  private readonly logger = new Logger(FunnelService.name);

  // Funnel tree changes only when an admin edits CMS; 60s staleness acceptable.
  // Backed by global CacheModule — in-memory locally, Redis on production.
  private readonly STRUCTURE_CACHE_KEY = 'funnel:structure';
  private readonly STRUCTURE_CACHE_TTL = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leadsService: LeadsService,
    private readonly dropoffQueueService: DropoffQueueService,
    @Inject(VIDEO_PROVIDER_TOKEN) private readonly videoProvider: IVideoProvider,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── GET /funnel/structure ─────────────────────────────────

  async getStructure(): Promise<FunnelStructureResult> {
    const cached = await this.cacheManager.get<FunnelStructureResult>(
      this.STRUCTURE_CACHE_KEY,
    );
    if (cached) return cached;

    const sections = await this.prisma.funnelSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        steps: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            content: { select: { title: true } },
            phoneGate: { select: { title: true } },
            paymentGate: { select: { title: true } },
          },
        },
      },
    });

    const result: FunnelStructureResult = {
      sections: sections.map((section) => ({
        uuid: section.uuid,
        name: section.name,
        description: section.description,
        order: section.order,
        steps: section.steps.map((step) => ({
          uuid: step.uuid,
          type: step.type,
          order: step.order,
          isActive: step.isActive,
          title: this.resolveStepTitle(step),
        })),
      })),
    };

    await this.cacheManager.set(
      this.STRUCTURE_CACHE_KEY,
      result,
      this.STRUCTURE_CACHE_TTL,
    );

    return result;
  }

  /**
   * Invalidate the funnel structure cache.
   * Called by FunnelCmsService after successful edits.
   * Fire-and-forget from CMS side — caller does not await.
   */
  async invalidateStructureCache(): Promise<void> {
    await this.cacheManager.del(this.STRUCTURE_CACHE_KEY);
  }

  private resolveStepTitle(step: {
    type: StepType;
    content: { title: string } | null;
    phoneGate: { title: string } | null;
    paymentGate: { title: string } | null;
  }): string {
    switch (step.type) {
      case StepType.VIDEO_TEXT:
        return step.content?.title ?? 'Video Step';
      case StepType.PHONE_GATE:
        return step.phoneGate?.title ?? 'Phone Verification';
      case StepType.PAYMENT_GATE:
        return step.paymentGate?.title ?? 'Payment';
      case StepType.DECISION:
        return 'Decision Step';
      default:
        return 'Step';
    }
  }

  // ─── GET /funnel/progress ──────────────────────────────────

  async getProgress(userUuid: string) {
    const progress = await this.getOrCreateProgress(userUuid);
    const completedStepUuids = progress.stepProgress
      .filter((sp) => sp.isCompleted)
      .map((sp) => sp.stepUuid);

    return {
      currentSectionUuid: progress.currentSectionUuid,
      currentStepUuid: progress.currentStepUuid,
      status: progress.status,
      phoneVerified: progress.phoneVerified,
      paymentCompleted: progress.paymentCompleted,
      decisionAnswer: progress.decisionAnswer,
      completedStepUuids,
    };
  }

  // ─── GET /funnel/step/:stepUuid ───────────────────────────

  async getStep(userUuid: string, stepUuid: string) {
    const step = await this.prisma.funnelStep.findUnique({
      where: { uuid: stepUuid },
      include: {
        content: true,
        phoneGate: true,
        paymentGate: true,
        decisionStep: true,
      },
    });

    if (!step || !step.isActive) {
      throw new NotFoundException('Step not found');
    }

    // Access control: user must have reached this step
    const progress = await this.getOrCreateProgress(userUuid);
    const completedStepUuids = new Set(
      progress.stepProgress
        .filter((sp) => sp.isCompleted)
        .map((sp) => sp.stepUuid),
    );

    const isCurrentStep = progress.currentStepUuid === stepUuid;
    const isCompleted = completedStepUuids.has(stepUuid);

    if (!isCurrentStep && !isCompleted) {
      throw new BadRequestException(
        'You must complete the previous steps first',
      );
    }

    switch (step.type) {
      case StepType.VIDEO_TEXT: {
        if (!step.content) return { type: step.type, content: null };

        const content = step.content;
        let videoUrl = content.videoUrl;
        let videoExpiry: number | null = null;
        let videoProvider = 'direct';

        if (content.bunnyVideoId) {
          videoUrl = this.videoProvider.getSignedUrl(content.bunnyVideoId);
          videoExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL
          videoProvider = 'bunny';
        }

        return {
          type: step.type,
          content: {
            uuid: content.uuid,
            stepUuid: content.stepUuid,
            title: content.title,
            description: content.description,
            videoUrl,
            videoExpiry,
            videoProvider,
            videoDuration: content.videoDuration,
            requireVideoCompletion: content.requireVideoCompletion,
            textContent: content.textContent,
          },
        };
      }
      case StepType.PHONE_GATE:
        return { type: step.type, phoneGate: step.phoneGate };
      case StepType.PAYMENT_GATE: {
        if (!step.paymentGate) return { type: step.type, paymentGate: null };

        const pg = step.paymentGate;
        let richContent: {
          subheading?: string;
          ctaText?: string;
          features?: string[];
          trustBadges?: string[];
          testimonials?: Array<{
            name: string;
            text: string;
            avatarInitials: string;
            location?: string;
          }>;
        } = {};
        try {
          if (pg.subtitle) {
            richContent = JSON.parse(pg.subtitle) as typeof richContent;
          }
        } catch {
          richContent = { subheading: pg.subtitle ?? '' };
        }

        const amount = Number(pg.amount);
        const originalPrice =
          pg.originalPrice !== null ? Number(pg.originalPrice) : null;
        const discountPercent =
          originalPrice !== null && originalPrice > amount
            ? Math.round(((originalPrice - amount) / originalPrice) * 100)
            : null;

        return {
          type: step.type,
          paymentGate: {
            heading: pg.title,
            subheading: richContent.subheading ?? '',
            amount,
            currency: pg.currency,
            ctaText: richContent.ctaText ?? 'Continue',
            features: richContent.features ?? [],
            trustBadges: richContent.trustBadges ?? [],
            testimonials: richContent.testimonials ?? [],
            allowCoupons: pg.allowCoupons,
            enabled: pg.isActive,
            badge: pg.badge ?? null,
            originalPrice,
            discountPercent,
          },
        };
      }
      case StepType.DECISION:
        return { type: step.type, decisionStep: step.decisionStep };
      default:
        return { type: step.type };
    }
  }

  // ─── POST /funnel/step/:stepUuid/complete ─────────────────

  async completeStep(
    userUuid: string,
    stepUuid: string,
    dto: CompleteStepDto,
    ipAddress: string,
  ) {
    const step = await this.prisma.funnelStep.findUnique({
      where: { uuid: stepUuid },
      include: { content: true },
    });

    if (!step || !step.isActive) {
      throw new NotFoundException('Step not found');
    }

    const progress = await this.getOrCreateProgress(userUuid);

    // Check if already completed — silent success
    const existing = progress.stepProgress.find(
      (sp) => sp.stepUuid === stepUuid,
    );
    if (existing?.isCompleted) {
      return { ok: true, message: 'Step already completed' };
    }

    // Step must be the current step (sequential enforcement)
    if (progress.currentStepUuid !== stepUuid) {
      throw new BadRequestException(
        'You must complete the previous steps first',
      );
    }

    // Video completion validation
    if (
      step.type === StepType.VIDEO_TEXT &&
      step.content?.requireVideoCompletion
    ) {
      const videoDuration = step.content.videoDuration ?? 0;
      const watchedSeconds = dto.watchedSeconds ?? 0;
      if (watchedSeconds < videoDuration - 3) {
        throw new BadRequestException(
          'Please watch the complete video before proceeding',
        );
      }
    }

    // Upsert step progress as completed
    await this.prisma.stepProgress.upsert({
      where: {
        funnelProgressUuid_stepUuid: {
          funnelProgressUuid: progress.uuid,
          stepUuid,
        },
      },
      create: {
        funnelProgressUuid: progress.uuid,
        stepUuid,
        isCompleted: true,
        watchedSeconds: dto.watchedSeconds ?? 0,
        completedAt: new Date(),
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
        watchedSeconds: dto.watchedSeconds ?? 0,
      },
    });

    // Fire-and-forget dropoff queue trigger for video steps
    if (step.type === StepType.VIDEO_TEXT) {
      this.dropoffQueueService
        .enqueueIfEligible(userUuid)
        .catch(() => {});
    }

    // Advance funnel progress
    const nextStep = await this.findNextStep(step.sectionUuid, step.order);

    const progressUpdate: Record<string, unknown> = {
      lastSeenAt: new Date(),
    };

    if (step.type === StepType.PHONE_GATE) {
      progressUpdate.phoneVerified = true;
    }

    if (nextStep) {
      progressUpdate.currentStepUuid = nextStep.uuid;
      progressUpdate.currentSectionUuid = nextStep.sectionUuid;
    } else {
      progressUpdate.status = 'COMPLETED';
      progressUpdate.currentStepUuid = null;
    }

    await this.prisma.funnelProgress.update({
      where: { uuid: progress.uuid },
      data: progressUpdate,
    });

    // Audit log
    this.audit.log({
      actorUuid: userUuid,
      action: 'FUNNEL_STEP_COMPLETED',
      metadata: { stepUuid, stepType: step.type },
      ipAddress,
    });

    return { ok: true };
  }

  // ─── POST /funnel/step/:stepUuid/video-progress ───────────

  async saveVideoProgress(
    userUuid: string,
    stepUuid: string,
    watchedSeconds: number,
  ) {
    const now = new Date();

    // Hot path: narrow select + filtered stepProgress (1 row max, not N).
    // Shaves the per-ping payload from O(total steps) to O(1).
    const light = await this.prisma.funnelProgress.findUnique({
      where: { userUuid },
      select: {
        uuid: true,
        lastSeenAt: true,
        stepProgress: {
          where: { stepUuid },
          select: { watchedSeconds: true },
          take: 1,
        },
      },
    });

    let progressUuid: string;
    let lastSeenAt: Date | null;
    let existingWatched: number;

    if (light) {
      progressUuid = light.uuid;
      lastSeenAt = light.lastSeenAt;
      existingWatched = light.stepProgress[0]?.watchedSeconds ?? 0;
    } else {
      // Cold path: no funnelProgress row yet — seed it.
      const full = await this.getOrCreateProgress(userUuid);
      progressUuid = full.uuid;
      lastSeenAt = full.lastSeenAt;
      existingWatched =
        full.stepProgress.find((sp) => sp.stepUuid === stepUuid)
          ?.watchedSeconds ?? 0;
    }

    await this.prisma.stepProgress.upsert({
      where: {
        funnelProgressUuid_stepUuid: {
          funnelProgressUuid: progressUuid,
          stepUuid,
        },
      },
      create: {
        funnelProgressUuid: progressUuid,
        stepUuid,
        watchedSeconds,
      },
      update: {
        // Only update if new value is greater (never decrease)
        watchedSeconds: Math.max(watchedSeconds, existingWatched),
      },
    });

    // Skip heartbeat write when <30s old — UI "last seen" tolerates this.
    const shouldUpdateHeartbeat =
      !lastSeenAt || now.getTime() - lastSeenAt.getTime() > 30_000;

    if (shouldUpdateHeartbeat) {
      await this.prisma.funnelProgress.update({
        where: { uuid: progressUuid },
        data: { lastSeenAt: now },
      });
    }

    return { ok: true };
  }

  // ─── POST /funnel/decision ────────────────────────────────

  async recordDecision(userUuid: string, dto: DecisionDto, ipAddress: string) {
    const step = await this.prisma.funnelStep.findUnique({
      where: { uuid: dto.stepUuid },
    });

    if (!step || step.type !== StepType.DECISION) {
      throw new BadRequestException('Invalid decision step');
    }

    const progress = await this.getOrCreateProgress(userUuid);

    if (!progress.paymentCompleted) {
      throw new ForbiddenException('You must complete the payment step before recording your decision.');
    }
    if (progress.currentStepUuid !== dto.stepUuid) {
      throw new ForbiddenException('You must complete all previous steps before reaching this step.');
    }

    // Block if already YES — cannot change a YES decision
    if (progress.decisionAnswer === 'YES') {
      throw new BadRequestException('Decision already recorded');
    }
    // Allow NO → YES change (user reconsidered after nurture)
    // Block YES → NO or any other repeat
    if (progress.decisionAnswer === 'NO' && dto.answer === 'NO') {
      throw new BadRequestException('Decision already recorded');
    }

    // Update funnel progress with decision
    await this.prisma.funnelProgress.update({
      where: { uuid: progress.uuid },
      data: {
        decisionAnswer: dto.answer,
        decisionAnsweredAt: new Date(),
        // On YES: clear currentStepUuid (funnel complete)
        // On NO: keep pointing to decision step so user can revisit
        ...(dto.answer === 'YES'
          ? { currentStepUuid: null, status: 'COMPLETED' }
          : { currentStepUuid: dto.stepUuid }),
      },
    });

    // Mark step as completed
    await this.prisma.stepProgress.upsert({
      where: {
        funnelProgressUuid_stepUuid: {
          funnelProgressUuid: progress.uuid,
          stepUuid: dto.stepUuid,
        },
      },
      create: {
        funnelProgressUuid: progress.uuid,
        stepUuid: dto.stepUuid,
        isCompleted: true,
        completedAt: new Date(),
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    if (dto.answer === 'YES') {
      // Look up distributorUuid from UserAcquisition
      const acquisition = await this.prisma.userAcquisition.findUnique({
        where: { userUuid },
      });

      // Update lead to HOT — fire and forget
      void this.leadsService.onDecisionYes(userUuid);

      this.audit.log({
        actorUuid: userUuid,
        action: 'DECISION_YES',
        metadata: {
          stepUuid: dto.stepUuid,
          distributorUuid: acquisition?.distributorUuid ?? null,
        },
        ipAddress,
      });
    } else {
      // Enroll lead in nurture sequence — fire and forget
      // NurtureService cron job handles the actual email sends on schedule
      void this.leadsService.onDecisionNo(userUuid);

      this.audit.log({
        actorUuid: userUuid,
        action: 'DECISION_NO',
        metadata: { stepUuid: dto.stepUuid },
        ipAddress,
      });
    }

    return { ok: true };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async getOrCreateProgress(userUuid: string) {
    const existing = await this.prisma.funnelProgress.findUnique({
      where: { userUuid },
      include: { stepProgress: true },
    });

    if (existing) {
      // If user has no current step and funnel is not completed,
      // re-initialize to the first active step (handles users who
      // registered before any funnel steps were created)
      if (!existing.currentStepUuid && existing.status !== 'COMPLETED') {
        const firstSection = await this.prisma.funnelSection.findFirst({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            steps: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
              take: 1,
            },
          },
        });
        const firstStep = firstSection?.steps[0];
        if (firstStep) {
          return this.prisma.funnelProgress.update({
            where: { uuid: existing.uuid },
            data: {
              currentSectionUuid: firstSection!.uuid,
              currentStepUuid: firstStep.uuid,
            },
            include: { stepProgress: true },
          });
        }
      }
      return existing;
    }

    // Find the first active step in the first active section
    const firstSection = await this.prisma.funnelSection.findFirst({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        steps: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
    });

    const firstStep = firstSection?.steps[0];

    return this.prisma.funnelProgress.create({
      data: {
        userUuid,
        currentSectionUuid: firstSection?.uuid ?? null,
        currentStepUuid: firstStep?.uuid ?? null,
      },
      include: { stepProgress: true },
    });
  }

  private async findNextStep(
    currentSectionUuid: string,
    currentStepOrder: number,
  ) {
    // Try next step in same section
    const nextInSection = await this.prisma.funnelStep.findFirst({
      where: {
        sectionUuid: currentSectionUuid,
        isActive: true,
        order: { gt: currentStepOrder },
      },
      orderBy: { order: 'asc' },
    });

    if (nextInSection) return nextInSection;

    // Try first step in next section
    const currentSection = await this.prisma.funnelSection.findUnique({
      where: { uuid: currentSectionUuid },
    });

    if (!currentSection) return null;

    const nextSection = await this.prisma.funnelSection.findFirst({
      where: {
        isActive: true,
        order: { gt: currentSection.order },
      },
      orderBy: { order: 'asc' },
      include: {
        steps: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
    });

    return nextSection?.steps[0] ?? null;
  }
}
