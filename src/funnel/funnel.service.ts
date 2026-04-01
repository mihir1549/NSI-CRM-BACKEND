import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LeadsService } from '../leads/leads.service.js';
import { StepType } from '@prisma/client';
import type { CompleteStepDto } from './dto/complete-step.dto.js';
import type { DecisionDto } from './dto/decision.dto.js';

@Injectable()
export class FunnelService {
  private readonly logger = new Logger(FunnelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leadsService: LeadsService,
  ) {}

  // ─── GET /funnel/structure ─────────────────────────────────

  async getStructure() {
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

    return {
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
      progress.stepProgress.filter((sp) => sp.isCompleted).map((sp) => sp.stepUuid),
    );

    const isCurrentStep = progress.currentStepUuid === stepUuid;
    const isCompleted = completedStepUuids.has(stepUuid);

    if (!isCurrentStep && !isCompleted) {
      throw new BadRequestException('You must complete the previous steps first');
    }

    switch (step.type) {
      case StepType.VIDEO_TEXT:
        return { type: step.type, content: step.content };
      case StepType.PHONE_GATE:
        return { type: step.type, phoneGate: step.phoneGate };
      case StepType.PAYMENT_GATE:
        return {
          type: step.type,
          paymentGate: step.paymentGate
            ? {
                title: step.paymentGate.title,
                subtitle: step.paymentGate.subtitle,
                amount: step.paymentGate.amount.toString(),
                currency: step.paymentGate.currency,
              }
            : null,
        };
      case StepType.DECISION:
        return { type: step.type, decisionStep: step.decisionStep };
      default:
        return { type: step.type };
    }
  }

  // ─── POST /funnel/step/:stepUuid/complete ─────────────────

  async completeStep(userUuid: string, stepUuid: string, dto: CompleteStepDto, ipAddress: string) {
    const step = await this.prisma.funnelStep.findUnique({
      where: { uuid: stepUuid },
      include: { content: true },
    });

    if (!step || !step.isActive) {
      throw new NotFoundException('Step not found');
    }

    const progress = await this.getOrCreateProgress(userUuid);

    // Check if already completed — silent success
    const existing = progress.stepProgress.find((sp) => sp.stepUuid === stepUuid);
    if (existing?.isCompleted) {
      return { ok: true, message: 'Step already completed' };
    }

    // Step must be the current step (sequential enforcement)
    if (progress.currentStepUuid !== stepUuid) {
      throw new BadRequestException('You must complete the previous steps first');
    }

    // Video completion validation
    if (step.type === StepType.VIDEO_TEXT && step.content?.requireVideoCompletion) {
      const videoDuration = step.content.videoDuration ?? 0;
      const watchedSeconds = dto.watchedSeconds ?? 0;
      if (watchedSeconds < videoDuration - 3) {
        throw new BadRequestException('Please watch the complete video before proceeding');
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

  async saveVideoProgress(userUuid: string, stepUuid: string, watchedSeconds: number) {
    const progress = await this.getOrCreateProgress(userUuid);

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
        watchedSeconds,
      },
      update: {
        // Only update if new value is greater (never decrease)
        watchedSeconds: Math.max(
          watchedSeconds,
          progress.stepProgress.find((sp) => sp.stepUuid === stepUuid)?.watchedSeconds ?? 0,
        ),
      },
    });

    await this.prisma.funnelProgress.update({
      where: { uuid: progress.uuid },
      data: { lastSeenAt: new Date() },
    });

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

    // Decision must not already be recorded
    if (progress.decisionAnswer) {
      throw new BadRequestException('Decision already recorded');
    }

    // Update funnel progress with decision
    await this.prisma.funnelProgress.update({
      where: { uuid: progress.uuid },
      data: {
        decisionAnswer: dto.answer,
        decisionAnsweredAt: new Date(),
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
      const acquisition = await this.prisma.userAcquisition.findUnique({ where: { userUuid } });

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

    if (existing) return existing;

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

  private async findNextStep(currentSectionUuid: string, currentStepOrder: number) {
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
