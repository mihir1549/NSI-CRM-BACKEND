import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { WhatsAppService } from '../notifications/whatsapp.service.js';
import { LeadAlertService } from '../notifications/lead-alert.service.js';

export interface MetaLeadWebhookData {
  fullName: string;
  phone: string;
  email?: string;
  referralCode?: string;
  metaFormId?: string;
  metaLeadgenId?: string;
  rawPayload?: Prisma.InputJsonValue;
}

@Injectable()
export class MetaLeadWebhookService {
  private readonly logger = new Logger(MetaLeadWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly leadAlertService: LeadAlertService,
  ) {}

  async createFromWebhook(data: MetaLeadWebhookData): Promise<void> {
    // 1. Duplicate check — metaLeadgenId
    if (data.metaLeadgenId) {
      const existing = await this.prisma.metaLead.findUnique({
        where: { metaLeadgenId: data.metaLeadgenId },
      });
      if (existing) {
        this.logger.log(
          `[MetaLead] Duplicate leadgenId ${data.metaLeadgenId} — skipping`,
        );
        return;
      }
    }

    // 2. Duplicate check — phone
    const phoneExists = await this.prisma.metaLead.findFirst({
      where: { phone: data.phone },
    });
    if (phoneExists) {
      this.logger.log(`[MetaLead] Duplicate phone ${data.phone} — skipping`);
      return;
    }

    // 3. Find distributor by referral code
    let distributorUuid: string | null = null;
    if (data.referralCode) {
      const distributor = await this.prisma.user.findFirst({
        where: { distributorCode: data.referralCode, role: 'DISTRIBUTOR' },
        select: { uuid: true },
      });
      distributorUuid = distributor?.uuid ?? null;
    }

    // 4. Create MetaLead record
    const metaLead = await this.prisma.metaLead.create({
      data: {
        distributorUuid,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        referralCode: data.referralCode,
        metaFormId: data.metaFormId,
        metaLeadgenId: data.metaLeadgenId,
        status: 'NEW',
        rawPayload: data.rawPayload,
      },
    });

    // 5. Send WhatsApp to the lead if distributor has autoWhatsApp enabled
    if (distributorUuid) {
      const pref = await this.prisma.socialPreference.findUnique({
        where: { distributorUuid },
      });

      if (pref?.autoWhatsApp !== false) {
        const dist = await this.prisma.user.findUnique({
          where: { uuid: distributorUuid },
          select: { distributorCode: true },
        });
        const frontendUrl =
          process.env.FRONTEND_URL ?? 'https://growithnsi.com';
        const joinLink = `${frontendUrl}/join/${dist?.distributorCode ?? ''}`;
        const msg =
          `Hi ${data.fullName}! You showed interest in alkaline ionized water.\n` +
          `Learn more here:\n${joinLink}`;

        this.whatsAppService.sendMessage(data.phone, msg).catch((err) =>
          this.logger.error(
            `[MetaLead] WhatsApp to lead failed: ${(err as Error).message}`,
          ),
        );

        await this.prisma.metaLead.update({
          where: { uuid: metaLead.uuid },
          data: { whatsappSentAt: new Date() },
        });
      }
    }

    // 6. Notify distributor / super admin (always for MetaLeads)
    this.leadAlertService
      .notifyNewLeadMeta(metaLead.uuid, distributorUuid)
      .catch((err) =>
        this.logger.error(
          `[MetaLead] notifyNewLeadMeta failed: ${(err as Error).message}`,
        ),
      );
  }

  async processPayload(body: unknown): Promise<void> {
    const payload = body as {
      entry?: Array<{
        changes?: Array<{
          field?: string;
          value?: {
            leadgen_id?: string;
            form_id?: string;
            field_data?: Array<{ name?: string; values?: string[] }>;
          };
        }>;
      }>;
    };

    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change.field !== 'leadgen') continue;

        const value = change.value ?? {};
        const leadgenId = value.leadgen_id;
        const formId = value.form_id;

        const fields: Record<string, string> = {};
        for (const field of value.field_data ?? []) {
          if (field.name) {
            fields[field.name] = field.values?.[0] ?? '';
          }
        }

        const fullName = fields['full_name'] || fields['name'] || '';
        const phone =
          fields['phone_number'] || fields['phone'] || fields['mobile'] || '';
        const email = fields['email'] || '';
        const referralCode =
          fields['referral_code'] || fields['distributor_code'] || '';

        if (!phone && !fullName) continue;

        await this.createFromWebhook({
          fullName,
          phone,
          email: email || undefined,
          referralCode: referralCode || undefined,
          metaFormId: formId,
          metaLeadgenId: leadgenId,
          rawPayload: value as Prisma.InputJsonValue,
        });
      }
    }
  }
}
