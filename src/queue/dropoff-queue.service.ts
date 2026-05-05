import { Injectable, Logger } from '@nestjs/common';
import { MessageTemplateType, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { WhatsAppService } from '../notifications/whatsapp.service.js';
import { SocialConfigService } from '../social/social-config.service.js';

interface RenderedTemplate {
  type: MessageTemplateType;
  content: string | null;
  mediaUrl: string | null;
  caption: string | null;
}

@Injectable()
export class DropoffQueueService {
  private readonly logger = new Logger(DropoffQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly configService: SocialConfigService,
  ) {}

  async enqueueIfEligible(userUuid: string): Promise<void> {
    // 1. Read inactivity delay from config
    const delayHours = await this.configService.getNumber(
      'DROPOFF_CHECK_HOURS',
      2,
    );

    // 2. Idempotency — already pending in queue?
    const existing = await this.prisma.dropoffQueue.findFirst({
      where: { userUuid, status: QueueStatus.PENDING },
    });
    if (existing) return;

    // 3. Already paid? skip
    const paid = await this.prisma.funnelProgress.findFirst({
      where: { userUuid, paymentCompleted: true },
      select: { uuid: true },
    });
    if (paid) return;

    // 4. Active sequence steps
    const steps = await this.prisma.dropoffSequence.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    if (steps.length === 0) return;

    // 5. Create queue records
    const now = new Date();
    await this.prisma.dropoffQueue.createMany({
      data: steps.map((step) => ({
        userUuid,
        sequenceUuid: step.uuid,
        templateUuid: step.templateUuid,
        channel: step.channel,
        sendAt:
          step.dayOffset === 0
            ? new Date(now.getTime() + delayHours * 60 * 60 * 1000)
            : new Date(
                now.getTime() + step.dayOffset * 24 * 60 * 60 * 1000,
              ),
        status: QueueStatus.PENDING,
      })),
    });

    this.logger.log(
      `[Dropoff] Enqueued ${steps.length} step(s) for user ${userUuid}`,
    );
  }

  async sendPendingDropoffs(): Promise<void> {
    const due = await this.prisma.dropoffQueue.findMany({
      where: {
        status: QueueStatus.PENDING,
        sendAt: { lte: new Date() },
      },
      include: {
        user: {
          select: {
            fullName: true,
            profile: { select: { phone: true } },
          },
        },
      },
      take: 50,
    });

    for (const item of due) {
      try {
        // Cancel remaining if user paid since enqueue
        const paid = await this.prisma.funnelProgress.findFirst({
          where: { userUuid: item.userUuid, paymentCompleted: true },
          select: { uuid: true },
        });

        if (paid) {
          await this.prisma.dropoffQueue.updateMany({
            where: {
              userUuid: item.userUuid,
              status: QueueStatus.PENDING,
            },
            data: { status: QueueStatus.CANCELLED },
          });
          continue;
        }

        const lead = await this.prisma.lead.findFirst({
          where: { userUuid: item.userUuid },
          include: { distributor: { select: { distributorCode: true } } },
          orderBy: { createdAt: 'desc' },
        });

        const frontendUrl =
          process.env.FRONTEND_URL ?? 'https://growithnsi.com';
        const joinLink = lead?.distributor?.distributorCode
          ? `${frontendUrl}/join/${lead.distributor.distributorCode}`
          : frontendUrl;

        const rendered = await this.renderTemplate(item.templateUuid, {
          name: item.user?.fullName ?? 'there',
          join_link: joinLink,
          distributor_name: '',
          topic: '',
        });

        const phone = item.user?.profile?.phone ?? null;
        if (item.channel === 'WHATSAPP' && phone) {
          await this.whatsAppService.sendMessage(
            phone,
            rendered.content ?? rendered.caption ?? '',
          );
        }

        await this.prisma.dropoffQueue.update({
          where: { uuid: item.uuid },
          data: { status: QueueStatus.SENT, sentAt: new Date() },
        });
      } catch (err) {
        await this.prisma.dropoffQueue.update({
          where: { uuid: item.uuid },
          data: {
            status: QueueStatus.FAILED,
            failureReason: err instanceof Error ? err.message : String(err),
          },
        });
        this.logger.error(
          `[Dropoff] Send failed for ${item.uuid}: ${(err as Error).message}`,
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
