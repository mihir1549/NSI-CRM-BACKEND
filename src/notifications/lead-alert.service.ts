import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SseService } from '../sse/sse.service.js';
import { WhatsAppService } from './whatsapp.service.js';

const CRM_LEAD_SOURCE = 'MANUAL';

@Injectable()
export class LeadAlertService {
  private readonly logger = new Logger(LeadAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly sseService: SseService,
  ) {}

  async notifyNewLead(
    leadUuid: string,
    distributorUuid: string | null,
  ): Promise<void> {
    try {
      const lead = await this.prisma.lead.findUnique({
        where: { uuid: leadUuid },
        include: { user: { select: { fullName: true } } },
      });
      if (!lead) return;

      let recipientUuid: string;

      if (distributorUuid) {
        recipientUuid = distributorUuid;

        // Source filter — CRM leads have no source column, so treat as MANUAL
        const preference = await this.prisma.socialPreference.findUnique({
          where: { distributorUuid },
        });
        const sources = preference?.notifyOnSources ?? [];
        const shouldNotify =
          sources.length === 0 || sources.includes(CRM_LEAD_SOURCE);
        if (!shouldNotify) return;
      } else {
        const superAdmin = await this.prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN' },
          select: { uuid: true },
        });
        if (!superAdmin) return;
        recipientUuid = superAdmin.uuid;
      }

      const recipient = await this.prisma.user.findUnique({
        where: { uuid: recipientUuid },
        select: { fullName: true },
      });

      const recipientProfile = await this.prisma.userProfile.findUnique({
        where: { userUuid: recipientUuid },
        select: { phone: true },
      });

      const message =
        `New lead assigned!\n` +
        `Name: ${lead.user?.fullName ?? 'Unknown'}\n` +
        `Phone: ${lead.phone ?? 'N/A'}\n` +
        `Source: ${CRM_LEAD_SOURCE}`;

      if (recipientProfile?.phone) {
        this.whatsAppService
          .sendMessage(recipientProfile.phone, message)
          .catch((err) =>
            this.logger.error(
              `WhatsApp send failed for ${recipientUuid}: ${(err as Error).message}`,
            ),
          );
      }

      this.sseService.sendToUser(recipientUuid, {
        type: 'notification',
        data: {
          type: 'NEW_LEAD',
          leadUuid,
          message: `New lead: ${lead.user?.fullName ?? 'Unknown'}`,
          recipientName: recipient?.fullName,
        },
      });
    } catch (err) {
      this.logger.error(
        `notifyNewLead failed for ${leadUuid}: ${(err as Error).message}`,
      );
    }
  }

  async notifyNewLeadMeta(
    metaLeadUuid: string,
    distributorUuid: string | null,
  ): Promise<void> {
    try {
      const metaLead = await this.prisma.metaLead.findUnique({
        where: { uuid: metaLeadUuid },
      });
      if (!metaLead) return;

      let recipientUuid: string;

      if (distributorUuid) {
        recipientUuid = distributorUuid;
      } else {
        const superAdmin = await this.prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN' },
          select: { uuid: true },
        });
        if (!superAdmin) return;
        recipientUuid = superAdmin.uuid;
      }

      const recipientProfile = await this.prisma.userProfile.findUnique({
        where: { userUuid: recipientUuid },
        select: { phone: true },
      });

      const message =
        `New Meta Lead Ad submission!\n` +
        `Name: ${metaLead.fullName}\n` +
        `Phone: ${metaLead.phone}\n` +
        `Source: META_LEAD_FORM`;

      if (recipientProfile?.phone) {
        this.whatsAppService
          .sendMessage(recipientProfile.phone, message)
          .catch((err) =>
            this.logger.error(
              `WhatsApp send failed for ${recipientUuid}: ${(err as Error).message}`,
            ),
          );
      }

      this.sseService.sendToUser(recipientUuid, {
        type: 'notification',
        data: {
          type: 'NEW_META_LEAD',
          metaLeadUuid,
          message: `New Meta lead: ${metaLead.fullName}`,
        },
      });
    } catch (err) {
      this.logger.error(
        `notifyNewLeadMeta failed for ${metaLeadUuid}: ${(err as Error).message}`,
      );
    }
  }

  async notifyLeadHot(
    leadUuid: string,
    distributorUuid: string | null,
  ): Promise<void> {
    try {
      const lead = await this.prisma.lead.findUnique({
        where: { uuid: leadUuid },
        include: { user: { select: { fullName: true } } },
      });
      if (!lead) return;

      let recipientUuid: string;
      const isDistributor = !!distributorUuid;

      if (distributorUuid) {
        recipientUuid = distributorUuid;
      } else {
        const superAdmin = await this.prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN' },
          select: { uuid: true },
        });
        if (!superAdmin) return;
        recipientUuid = superAdmin.uuid;
      }

      const recipientProfile = await this.prisma.userProfile.findUnique({
        where: { userUuid: recipientUuid },
        select: { phone: true },
      });

      const leadName = lead.user?.fullName ?? 'Unknown';
      const leadPhone = lead.phone ?? 'N/A';
      const message = isDistributor
        ? `Your lead ${leadName} is HOT!\nFollow up RIGHT NOW.\nCall: ${leadPhone}`
        : `Unassigned lead ${leadName} is HOT!\nAssign to a distributor immediately.`;

      if (recipientProfile?.phone) {
        this.whatsAppService
          .sendMessage(recipientProfile.phone, message)
          .catch((err) =>
            this.logger.error(
              `WhatsApp send failed for ${recipientUuid}: ${(err as Error).message}`,
            ),
          );
      }

      this.sseService.sendToUser(recipientUuid, {
        type: 'notification',
        data: {
          type: 'LEAD_HOT',
          leadUuid,
          message: `Lead HOT: ${leadName}`,
        },
      });
    } catch (err) {
      this.logger.error(
        `notifyLeadHot failed for ${leadUuid}: ${(err as Error).message}`,
      );
    }
  }
}
