import { Injectable, Logger } from '@nestjs/common';
import { MessageTemplateType, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { WhatsAppService } from '../notifications/whatsapp.service.js';

interface RenderedTemplate {
  type: MessageTemplateType;
  content: string | null;
  mediaUrl: string | null;
  caption: string | null;
}

@Injectable()
export class OnboardingQueueService {
  private readonly logger = new Logger(OnboardingQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async enqueueForDistributor(distributorUuid: string): Promise<void> {
    // 1. Idempotency check
    const existing = await this.prisma.onboardingQueue.findFirst({
      where: { distributorUuid },
    });
    if (existing) return;

    // 2. Active sequence steps
    const steps = await this.prisma.onboardingSequence.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    if (steps.length === 0) return;

    // 3. Create queue records
    const now = new Date();
    await this.prisma.onboardingQueue.createMany({
      data: steps.map((step) => ({
        distributorUuid,
        sequenceUuid: step.uuid,
        templateUuid: step.templateUuid,
        channel: step.channel,
        sendAt: new Date(
          now.getTime() + step.dayOffset * 24 * 60 * 60 * 1000,
        ),
        status: QueueStatus.PENDING,
      })),
    });

    this.logger.log(
      `[Onboarding] Enqueued ${steps.length} step(s) for ${distributorUuid}`,
    );
  }

  async sendPendingOnboarding(): Promise<void> {
    const due = await this.prisma.onboardingQueue.findMany({
      where: {
        status: QueueStatus.PENDING,
        sendAt: { lte: new Date() },
      },
      include: {
        distributor: {
          select: { fullName: true, distributorCode: true },
        },
      },
      take: 50,
    });

    for (const item of due) {
      try {
        const phoneRow = await this.prisma.userProfile.findUnique({
          where: { userUuid: item.distributorUuid },
          select: { phone: true },
        });

        const frontendUrl =
          process.env.FRONTEND_URL ?? 'https://growithnsi.com';
        const rendered = await this.renderTemplate(item.templateUuid, {
          name: item.distributor?.fullName ?? '',
          join_link: `${frontendUrl}/join/${item.distributor?.distributorCode ?? ''}`,
          distributor_name: item.distributor?.fullName ?? '',
          topic: '',
        });

        if (item.channel === 'WHATSAPP' && phoneRow?.phone) {
          await this.whatsAppService.sendMessage(
            phoneRow.phone,
            rendered.content ?? rendered.caption ?? '',
          );
        }

        await this.prisma.onboardingQueue.update({
          where: { uuid: item.uuid },
          data: { status: QueueStatus.SENT, sentAt: new Date() },
        });
      } catch (err) {
        await this.prisma.onboardingQueue.update({
          where: { uuid: item.uuid },
          data: {
            status: QueueStatus.FAILED,
            failureReason: err instanceof Error ? err.message : String(err),
          },
        });
        this.logger.error(
          `[Onboarding] Send failed for ${item.uuid}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async renderTemplate(
    templateUuid: string,
    variables: Record<string, string>,
  ): Promise<RenderedTemplate> {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { uuid: templateUuid },
    });
    if (!template || !template.isActive) {
      throw new Error(`Template ${templateUuid} not found or inactive`);
    }

    const replace = (text: string | null): string | null => {
      if (!text) return text;
      return Object.entries(variables).reduce(
        (acc, [key, val]) =>
          acc.replace(new RegExp(`\\{${key}\\}`, 'g'), val),
        text,
      );
    };

    return {
      type: template.type,
      content: replace(template.content),
      mediaUrl: template.mediaUrl,
      caption: replace(template.caption),
    };
  }
}
