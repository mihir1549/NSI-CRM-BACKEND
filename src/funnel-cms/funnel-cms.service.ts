import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FunnelService } from '../funnel/funnel.service.js';
import { StepType } from '@prisma/client';
import type {
  CreateSectionDto,
  ReorderItemDto,
  UpdateSectionDto,
} from './dto/section.dto.js';
import type { CreateStepDto, UpdateStepDto } from './dto/step.dto.js';
import type {
  UpdateDecisionStepDto,
  UpdatePaymentGateDto,
  UpdatePhoneGateDto,
  UpdateStepContentDto,
} from './dto/step-content.dto.js';

@Injectable()
export class FunnelCmsService {
  private readonly logger = new Logger(FunnelCmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly funnelService: FunnelService,
  ) {}

  // ─── SECTION CRUD ──────────────────────────────────────────

  async createSection(dto: CreateSectionDto) {
    const created = await this.prisma.funnelSection.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        order: dto.order,
      },
    });
    this.funnelService.invalidateStructureCache();
    return created;
  }

  async getAllSections() {
    return this.prisma.funnelSection.findMany({
      orderBy: { order: 'asc' },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            content: true,
            phoneGate: true,
            paymentGate: true,
            decisionStep: true,
          },
        },
      },
    });
  }

  async updateSection(uuid: string, dto: UpdateSectionDto) {
    const section = await this.prisma.funnelSection.findUnique({
      where: { uuid },
    });
    if (!section) throw new NotFoundException('Section not found');

    const updated = await this.prisma.funnelSection.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    this.funnelService.invalidateStructureCache();
    return updated;
  }

  async getSectionForUpdate(uuid: string) {
    const section = await this.prisma.funnelSection.findUnique({
      where: { uuid },
    });
    if (!section) throw new NotFoundException('Section not found');
    return {
      name: section.name,
      description: section.description,
      order: section.order,
      isActive: section.isActive,
    };
  }

  async deleteSection(uuid: string) {
    const section = await this.prisma.funnelSection.findUnique({
      where: { uuid },
    });
    if (!section) throw new NotFoundException('Section not found');

    // Check if any users are currently on this section
    const usersOnSection = await this.prisma.funnelProgress.count({
      where: { currentSectionUuid: uuid },
    });

    if (usersOnSection > 0) {
      throw new BadRequestException(
        `Cannot delete section — ${usersOnSection} user(s) are currently on it`,
      );
    }

    await this.prisma.funnelSection.delete({ where: { uuid } });
    this.funnelService.invalidateStructureCache();
    return { ok: true };
  }

  async reorderSections(items: ReorderItemDto[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.funnelSection.update({
          where: { uuid: item.uuid },
          data: { order: item.order },
        }),
      ),
    );
    this.funnelService.invalidateStructureCache();
    return { ok: true };
  }

  // ─── STEP CRUD ─────────────────────────────────────────────

  async createStep(dto: CreateStepDto) {
    const section = await this.prisma.funnelSection.findUnique({
      where: { uuid: dto.sectionUuid },
    });
    if (!section) throw new NotFoundException('Section not found');

    const step = await this.prisma.funnelStep.create({
      data: {
        sectionUuid: dto.sectionUuid,
        type: dto.type,
        order: dto.order,
      },
    });

    // Create default config/content for the step type
    switch (dto.type) {
      case StepType.VIDEO_TEXT:
        await this.prisma.stepContent.create({
          data: { stepUuid: step.uuid, title: 'New Video Step' },
        });
        break;
      case StepType.PHONE_GATE:
        await this.prisma.phoneGateConfig.create({
          data: { stepUuid: step.uuid },
        });
        break;
      case StepType.PAYMENT_GATE:
        await this.prisma.paymentGateConfig.create({
          data: { stepUuid: step.uuid, amount: 0 },
        });
        break;
      case StepType.DECISION:
        await this.prisma.decisionStepConfig.create({
          data: { stepUuid: step.uuid },
        });
        break;
    }

    this.funnelService.invalidateStructureCache();
    return this.getStepById(step.uuid);
  }

  async getStepById(uuid: string) {
    const step = await this.prisma.funnelStep.findUnique({
      where: { uuid },
      include: {
        content: true,
        phoneGate: true,
        paymentGate: true,
        decisionStep: true,
      },
    });
    if (!step) throw new NotFoundException('Step not found');
    return step;
  }

  async updateStep(uuid: string, dto: UpdateStepDto) {
    const step = await this.prisma.funnelStep.findUnique({ where: { uuid } });
    if (!step) throw new NotFoundException('Step not found');

    const updated = await this.prisma.funnelStep.update({
      where: { uuid },
      data: {
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    this.funnelService.invalidateStructureCache();
    return updated;
  }

  async getStepForUpdate(uuid: string) {
    const step = await this.prisma.funnelStep.findUnique({ where: { uuid } });
    if (!step) throw new NotFoundException('Step not found');
    return {
      order: step.order,
      isActive: step.isActive,
    };
  }

  async deleteStep(uuid: string) {
    const step = await this.prisma.funnelStep.findUnique({ where: { uuid } });
    if (!step) throw new NotFoundException('Step not found');

    // Check if any user has this as their current step
    const usersOnStep = await this.prisma.funnelProgress.count({
      where: { currentStepUuid: uuid },
    });

    if (usersOnStep > 0) {
      throw new BadRequestException(
        `Cannot delete step — ${usersOnStep} user(s) are currently on it`,
      );
    }

    await this.prisma.funnelStep.delete({ where: { uuid } });
    this.funnelService.invalidateStructureCache();
    return { ok: true };
  }

  async reorderSteps(items: ReorderItemDto[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.funnelStep.update({
          where: { uuid: item.uuid },
          data: { order: item.order },
        }),
      ),
    );
    this.funnelService.invalidateStructureCache();
    return { ok: true };
  }

  // ─── STEP CONTENT/CONFIG UPSERTS ──────────────────────────

  async upsertStepContent(stepUuid: string, dto: UpdateStepContentDto) {
    const step = await this.getStepById(stepUuid);
    if (step.type !== StepType.VIDEO_TEXT) {
      throw new BadRequestException(
        'This endpoint is only for VIDEO_TEXT steps',
      );
    }

    const result = await this.prisma.stepContent.upsert({
      where: { stepUuid },
      create: {
        stepUuid,
        title: dto.title,
        description: dto.description ?? null,
        videoUrl: (dto.videoUrl && dto.videoUrl !== '') ? dto.videoUrl : null,
        videoDuration: dto.videoDuration ?? null,
        textContent: dto.textContent ?? null,
        requireVideoCompletion: dto.requireVideoCompletion ?? true,
        bunnyVideoId: dto.bunnyVideoId ?? null,
      },
      update: {
        title: dto.title,
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.videoUrl !== undefined && dto.videoUrl !== '' && { videoUrl: dto.videoUrl }),
        ...(dto.videoDuration !== undefined && {
          videoDuration: dto.videoDuration,
        }),
        ...(dto.textContent !== undefined && { textContent: dto.textContent }),
        ...(dto.requireVideoCompletion !== undefined && {
          requireVideoCompletion: dto.requireVideoCompletion,
        }),
        ...(dto.bunnyVideoId !== undefined && {
          bunnyVideoId: dto.bunnyVideoId,
        }),
      },
    });
    this.funnelService.invalidateStructureCache();
    return result;
  }

  async getStepContentForUpdate(stepUuid: string) {
    const step = await this.getStepById(stepUuid);
    if (step.type !== StepType.VIDEO_TEXT || !step.content) {
      throw new BadRequestException('Content not found or invalid step type');
    }
    return {
      title: step.content.title,
      description: step.content.description,
      videoUrl: step.content.videoUrl,
      videoDuration: step.content.videoDuration,
      textContent: step.content.textContent,
      requireVideoCompletion: step.content.requireVideoCompletion,
      bunnyVideoId: step.content.bunnyVideoId,
    };
  }

  async upsertPhoneGate(stepUuid: string, dto: UpdatePhoneGateDto) {
    const step = await this.getStepById(stepUuid);
    if (step.type !== StepType.PHONE_GATE) {
      throw new BadRequestException(
        'This endpoint is only for PHONE_GATE steps',
      );
    }

    const result = await this.prisma.phoneGateConfig.upsert({
      where: { stepUuid },
      create: {
        stepUuid,
        title: dto.title ?? 'Verify your phone number',
        subtitle: dto.subtitle ?? null,
        isActive: dto.isActive ?? true,
      },
      update: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    this.funnelService.invalidateStructureCache();
    return result;
  }

  async getPhoneGateForUpdate(stepUuid: string) {
    const step = await this.getStepById(stepUuid);
    if (step.type !== StepType.PHONE_GATE || !step.phoneGate) {
      throw new BadRequestException(
        'Phone gate not found or invalid step type',
      );
    }
    return {
      title: step.phoneGate.title,
      subtitle: step.phoneGate.subtitle,
      isActive: step.phoneGate.isActive,
    };
  }

  async upsertPaymentGate(stepUuid: string, dto: UpdatePaymentGateDto) {
    const step = await this.getStepById(stepUuid);
    if (step.type !== StepType.PAYMENT_GATE) {
      throw new BadRequestException(
        'This endpoint is only for PAYMENT_GATE steps',
      );
    }

    // Store rich fields (features, trustBadges, testimonials, ctaText, subheading)
    // as JSON in the subtitle column — no migration needed.
    const richContent = JSON.stringify({
      subheading: dto.subheading,
      ctaText: dto.ctaText,
      features: dto.features,
      trustBadges: dto.trustBadges,
      testimonials: dto.testimonials,
    });

    const result = await this.prisma.paymentGateConfig.upsert({
      where: { stepUuid },
      create: {
        stepUuid,
        title: dto.heading, // heading → title
        subtitle: richContent, // rich fields → subtitle (JSON)
        amount: dto.amount,
        currency: dto.currency,
        allowCoupons: dto.allowCoupons,
        isActive: dto.enabled, // enabled → isActive
        badge: dto.badge ?? null,
        originalPrice: dto.originalPrice ?? null,
      },
      update: {
        title: dto.heading,
        subtitle: richContent,
        amount: dto.amount,
        currency: dto.currency,
        allowCoupons: dto.allowCoupons,
        isActive: dto.enabled,
        badge: dto.badge ?? null,
        originalPrice: dto.originalPrice ?? null,
      },
    });
    this.funnelService.invalidateStructureCache();
    return result;
  }

  async getPaymentGateForUpdate(stepUuid: string) {
    const step = await this.getStepById(stepUuid);
    if (step.type !== StepType.PAYMENT_GATE || !step.paymentGate) {
      throw new BadRequestException(
        'Payment gate not found or invalid step type',
      );
    }

    const pg = step.paymentGate;

    // Parse rich fields from subtitle JSON; fall back to safe defaults for old records
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
      // Old plain-text subtitle — treat as subheading, reset others to defaults
      richContent = { subheading: pg.subtitle ?? '' };
    }

    return {
      heading: pg.title,
      subheading: richContent.subheading ?? '',
      amount: Number(pg.amount),
      currency: pg.currency,
      ctaText: richContent.ctaText ?? 'Continue',
      features: richContent.features ?? [],
      trustBadges: richContent.trustBadges ?? [],
      testimonials: richContent.testimonials ?? [],
      allowCoupons: pg.allowCoupons,
      enabled: pg.isActive,
      badge: pg.badge ?? null,
      originalPrice: pg.originalPrice !== null ? Number(pg.originalPrice) : null,
    };
  }

  async upsertDecisionStep(stepUuid: string, dto: UpdateDecisionStepDto) {
    const step = await this.getStepById(stepUuid);
    if (step.type !== StepType.DECISION) {
      throw new BadRequestException('This endpoint is only for DECISION steps');
    }

    const result = await this.prisma.decisionStepConfig.upsert({
      where: { stepUuid },
      create: {
        stepUuid,
        question:
          dto.question ?? 'Are you interested in buying a Kangen machine?',
        yesLabel: dto.yesLabel ?? 'Yes, I am interested!',
        noLabel: dto.noLabel ?? 'Not right now',
        yesSubtext: dto.yesSubtext ?? null,
        noSubtext: dto.noSubtext ?? null,
      },
      update: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.yesLabel !== undefined && { yesLabel: dto.yesLabel }),
        ...(dto.noLabel !== undefined && { noLabel: dto.noLabel }),
        ...(dto.yesSubtext !== undefined && { yesSubtext: dto.yesSubtext }),
        ...(dto.noSubtext !== undefined && { noSubtext: dto.noSubtext }),
      },
    });
    this.funnelService.invalidateStructureCache();
    return result;
  }

  async getDecisionStepForUpdate(stepUuid: string) {
    const step = await this.getStepById(stepUuid);
    if (step.type !== StepType.DECISION || !step.decisionStep) {
      throw new BadRequestException(
        'Decision step not found or invalid step type',
      );
    }
    return {
      question: step.decisionStep.question,
      yesLabel: step.decisionStep.yesLabel,
      noLabel: step.decisionStep.noLabel,
      yesSubtext: step.decisionStep.yesSubtext,
      noSubtext: step.decisionStep.noSubtext,
    };
  }

  // ─── ANALYTICS ─────────────────────────────────────────────

  async getFunnelAnalytics() {
    const steps = await this.prisma.funnelStep.findMany({
      where: { isActive: true },
      orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }],
      include: {
        section: { select: { name: true } },
        content: { select: { title: true } },
        phoneGate: { select: { title: true } },
        paymentGate: { select: { title: true } },
        progress: true,
      },
    });

    return steps.map((step) => {
      const totalReached = step.progress.length;
      const totalCompleted = step.progress.filter((p) => p.isCompleted).length;
      const dropOffCount = totalReached - totalCompleted;
      const dropOffRate =
        totalReached > 0 ? (dropOffCount / totalReached) * 100 : 0;

      let stepTitle = 'Decision Step';
      if (step.type === StepType.VIDEO_TEXT)
        stepTitle = step.content?.title ?? 'Video Step';
      else if (step.type === StepType.PHONE_GATE)
        stepTitle = step.phoneGate?.title ?? 'Phone Gate';
      else if (step.type === StepType.PAYMENT_GATE)
        stepTitle = step.paymentGate?.title ?? 'Payment Gate';

      return {
        stepUuid: step.uuid,
        stepTitle,
        stepType: step.type,
        sectionName: step.section.name,
        order: step.order,
        totalReached,
        totalCompleted,
        dropOffCount,
        dropOffRate: Math.round(dropOffRate * 100) / 100,
      };
    });
  }

  async getUtmAnalytics() {
    const [bySource, byMedium, byCampaign, byDistributor] = await Promise.all([
      this.prisma.userAcquisition.groupBy({
        by: ['utmSource'],
        _count: { utmSource: true },
        orderBy: { _count: { utmSource: 'desc' } },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['utmMedium'],
        _count: { utmMedium: true },
        orderBy: { _count: { utmMedium: 'desc' } },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['utmCampaign'],
        _count: { utmCampaign: true },
        orderBy: { _count: { utmCampaign: 'desc' } },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['distributorCode', 'distributorUuid'],
        _count: { distributorCode: true },
        orderBy: { _count: { distributorCode: 'desc' } },
      }),
    ]);

    return {
      bySource: bySource.map((r) => ({
        utmSource: r.utmSource,
        count: r._count.utmSource,
      })),
      byMedium: byMedium.map((r) => ({
        utmMedium: r.utmMedium,
        count: r._count.utmMedium,
      })),
      byCampaign: byCampaign.map((r) => ({
        utmCampaign: r.utmCampaign,
        count: r._count.utmCampaign,
      })),
      byDistributor: byDistributor.map((r) => ({
        distributorCode: r.distributorCode,
        distributorUuid: r.distributorUuid,
        count: r._count.distributorCode,
      })),
    };
  }

  async getDeviceAnalytics() {
    const [byDevice, byCountry] = await Promise.all([
      this.prisma.userAcquisition.groupBy({
        by: ['deviceType'],
        _count: { deviceType: true },
        orderBy: { _count: { deviceType: 'desc' } },
      }),
      this.prisma.userAcquisition.groupBy({
        by: ['country'],
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
      }),
    ]);

    return {
      byDevice: byDevice.map((r) => ({
        deviceType: r.deviceType,
        count: r._count.deviceType,
      })),
      byCountry: byCountry.map((r) => ({
        country: r.country,
        count: r._count.country,
      })),
    };
  }

  async getConversionAnalytics() {
    const [
      totalRegistered,
      totalPhoneVerified,
      totalPaid,
      totalReachedDecision,
      totalYes,
      totalNo,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.funnelProgress.count({ where: { phoneVerified: true } }),
      this.prisma.funnelProgress.count({ where: { paymentCompleted: true } }),
      this.prisma.funnelProgress.count({
        where: { decisionAnswer: { not: null } },
      }),
      this.prisma.funnelProgress.count({ where: { decisionAnswer: 'YES' } }),
      this.prisma.funnelProgress.count({ where: { decisionAnswer: 'NO' } }),
    ]);

    const phoneVerifyRate =
      totalRegistered > 0 ? (totalPhoneVerified / totalRegistered) * 100 : 0;
    const paymentRate =
      totalPhoneVerified > 0 ? (totalPaid / totalPhoneVerified) * 100 : 0;
    const decisionRate =
      totalPaid > 0 ? (totalReachedDecision / totalPaid) * 100 : 0;
    const yesRate =
      totalReachedDecision > 0 ? (totalYes / totalReachedDecision) * 100 : 0;

    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      totalRegistered,
      totalPhoneVerified,
      totalPaid,
      totalReachedDecision,
      totalYes,
      totalNo,
      phoneVerifyRate: round(phoneVerifyRate),
      paymentRate: round(paymentRate),
      decisionRate: round(decisionRate),
      yesRate: round(yesRate),
    };
  }
}
