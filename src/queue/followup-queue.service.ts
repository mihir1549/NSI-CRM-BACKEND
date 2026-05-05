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
export class FollowupQueueService {
  private readonly logger = new Logger(FollowupQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async enqueueForLead(leadUuid: string): Promise<void> {
    // 1. Fetch lead and verify a phone exists somewhere
    const lead = await this.prisma.lead.findUnique({
      where: { uuid: leadUuid },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    const phone = lead?.phone ?? lead?.user?.profile?.phone ?? null;
    if (!phone) return;

    // 2. Idempotency check
    const existing = await this.prisma.followupQueue.findFirst({
      where: { leadUuid, leadType: 'CRM_LEAD' },
    });
    if (existing) return;

    // 3. Active sequence steps
    const steps = await this.prisma.followupSequence.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    if (steps.length === 0) return;

    // 4. Create queue records
    const now = new Date();
    await this.prisma.followupQueue.createMany({
      data: steps.map((step) => ({
        leadUuid,
        leadType: 'CRM_LEAD',
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
      `[Followup] Enqueued ${steps.length} step(s) for lead ${leadUuid}`,
    );
  }

  async sendPendingFollowups(): Promise<void> {
    const due = await this.prisma.followupQueue.findMany({
      where: {
        status: QueueStatus.PENDING,
        sendAt: { lte: new Date() },
        leadType: 'CRM_LEAD',
      },
      take: 50,
    });

    for (const item of due) {
      try {
        const lead = await this.prisma.lead.findUnique({
          where: { uuid: item.leadUuid },
          include: {
            user: {
              select: {
                uuid: true,
                fullName: true,
                profile: { select: { phone: true } },
              },
            },
            distributor: { select: { distributorCode: true } },
          },
        });

        if (!lead) {
          await this.prisma.followupQueue.update({
            where: { uuid: item.uuid },
            data: { status: QueueStatus.SKIPPED },
          });
          continue;
        }

        // If user already paid → cancel all remaining for this lead
        const paidProgress = await this.prisma.funnelProgress.findFirst({
          where: { userUuid: lead.userUuid, paymentCompleted: true },
          select: { uuid: true },
        });
        if (paidProgress) {
          await this.prisma.followupQueue.updateMany({
            where: {
              leadUuid: item.leadUuid,
              status: QueueStatus.PENDING,
            },
            data: { status: QueueStatus.CANCELLED },
          });
          continue;
        }

        const frontendUrl =
          process.env.FRONTEND_URL ?? 'https://growithnsi.com';
        const rendered = await this.renderTemplate(item.templateUuid, {
          name: lead.user?.fullName ?? 'there',
          join_link: `${frontendUrl}/join/${lead.distributor?.distributorCode ?? ''}`,
          distributor_name: '',
          topic: '',
        });

        const phone = lead.phone ?? lead.user?.profile?.phone ?? null;
        if (item.channel === 'WHATSAPP' && phone) {
          await this.whatsAppService.sendMessage(
            phone,
            rendered.content ?? rendered.caption ?? '',
          );
        }

        await this.prisma.followupQueue.update({
          where: { uuid: item.uuid },
          data: { status: QueueStatus.SENT, sentAt: new Date() },
        });
      } catch (err) {
        await this.prisma.followupQueue.update({
          where: { uuid: item.uuid },
          data: {
            status: QueueStatus.FAILED,
            failureReason: err instanceof Error ? err.message : String(err),
          },
        });
        this.logger.error(
          `[Followup] Send failed for ${item.uuid}: ${(err as Error).message}`,
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
