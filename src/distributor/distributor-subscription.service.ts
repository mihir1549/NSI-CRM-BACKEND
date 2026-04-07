import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { UserRole, LeadStatus } from '@prisma/client';
import { generateDistributorCode } from './distributor-code.helper.js';
import { v4 as uuidv4 } from 'uuid';
import type { SubscriptionQueryDto } from './dto/subscription-query.dto.js';
import type { SubscribeDto } from './dto/subscribe.dto.js';

@Injectable()
export class DistributorSubscriptionService {
  private readonly logger = new Logger(DistributorSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mailService: MailService,
  ) {}

  // ─── Admin: list subscriptions ───────────────────────────────────────────────

  async listSubscriptions(query: SubscriptionQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) {
      where['status'] = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.distributorSubscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { uuid: true, fullName: true, email: true, avatarUrl: true } },
          plan: { select: { name: true, amount: true } },
        },
      }),
      this.prisma.distributorSubscription.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Admin: get subscription detail ─────────────────────────────────────────

  async getSubscription(uuid: string) {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { uuid },
      include: {
        user: { select: { uuid: true, fullName: true, email: true, avatarUrl: true } },
        plan: true,
      },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    return sub;
  }

  // ─── Admin: cancel subscription ──────────────────────────────────────────────

  async cancelSubscription(uuid: string, actorUuid: string, ipAddress: string) {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { uuid },
      include: { user: true },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }

    const isMock = this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    if (!isMock) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
        key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
      });
      await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId);
    }

    const now = new Date();

    // Update subscription
    await this.prisma.distributorSubscription.update({
      where: { uuid },
      data: { status: 'CANCELLED', cancelledAt: now },
    });

    // Downgrade user role + deactivate join link
    await this.prisma.user.update({
      where: { uuid: sub.userUuid },
      data: { role: UserRole.CUSTOMER, joinLinkActive: false },
    });

    // Reassign HOT leads to Super Admin
    const superAdmin = await this.prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: 'asc' },
    });

    let leadsReassigned = 0;
    if (superAdmin) {
      const result = await this.prisma.lead.updateMany({
        where: { distributorUuid: sub.userUuid, status: LeadStatus.HOT },
        data: { assignedToUuid: superAdmin.uuid },
      });
      leadsReassigned = result.count;
    }

    // Fire-and-forget email
    this.mailService.sendSubscriptionCancelledByAdminEmail(sub.user.email, sub.user.fullName);

    // Audit log
    this.audit.log({
      actorUuid,
      action: 'ADMIN_CANCELLED_DISTRIBUTOR_SUBSCRIPTION',
      metadata: { userUuid: sub.userUuid, leadsReassigned },
      ipAddress,
    });

    return { message: 'Subscription cancelled successfully', leadsReassigned };
  }

  // ─── Self-service: subscribe ─────────────────────────────────────────────────

  async subscribe(userUuid: string, dto: SubscribeDto) {
    // Validate plan
    const plan = await this.prisma.distributorPlan.findUnique({ where: { uuid: dto.planUuid } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Plan not found or is no longer active');
    }

    // Check existing subscription
    const existing = await this.prisma.distributorSubscription.findUnique({
      where: { userUuid },
    });

    if (existing && (existing.status === 'ACTIVE' || existing.status === 'GRACE')) {
      throw new ConflictException('You already have an active subscription');
    }

    const isMock = this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    let razorpaySubscriptionId: string;
    let shortUrl: string | null = null;

    if (isMock) {
      razorpaySubscriptionId = `mock_sub_${uuidv4()}`;

      // Fire-and-forget mock activation after 2 seconds
      const subId = razorpaySubscriptionId;
      const planId = plan.uuid;
      setTimeout(() => {
        this.activateMockSubscription(userUuid, subId, planId).catch((err: Error) => {
          this.logger.error(`Mock subscription activation failed: ${err.message}`);
        });
      }, 2000);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
        key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
      });
      const sub = await razorpay.subscriptions.create({
        plan_id: plan.razorpayPlanId,
        total_count: 12, // 12 monthly cycles
        customer_notify: 1,
      });
      razorpaySubscriptionId = sub.id;
      shortUrl = sub.short_url ?? null;
    }

    return { subscriptionId: razorpaySubscriptionId, shortUrl };
  }

  /**
   * Fire-and-forget mock subscription activation (called after 2s delay).
   */
  private async activateMockSubscription(
    userUuid: string,
    razorpaySubscriptionId: string,
    planUuid: string,
  ): Promise<void> {
    const now = new Date();
    const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Upsert subscription record
    await this.prisma.distributorSubscription.upsert({
      where: { userUuid },
      create: {
        userUuid,
        planUuid,
        razorpaySubscriptionId,
        status: 'ACTIVE',
        currentPeriodEnd,
        graceDeadline: null,
        cancelledAt: null,
      },
      update: {
        planUuid,
        razorpaySubscriptionId,
        status: 'ACTIVE',
        currentPeriodEnd,
        graceDeadline: null,
        cancelledAt: null,
      },
    });

    // Upgrade user role
    const user = await this.prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!user) return;

    const distributorCode = user.distributorCode ?? (await generateDistributorCode(this.prisma));

    await this.prisma.user.update({
      where: { uuid: userUuid },
      data: {
        role: UserRole.DISTRIBUTOR,
        distributorCode,
        joinLinkActive: true,
      },
    });

    // Send subscription active email
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://growithnsi.com');
    const joinUrl = `${frontendUrl}/join/${distributorCode}`;
    this.mailService.sendSubscriptionActiveEmail(user.email, user.fullName, joinUrl, distributorCode);
  }

  // ─── Self-service: get own subscription ──────────────────────────────────────

  async getMySubscription(userUuid: string) {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { userUuid },
      include: { plan: { select: { name: true, amount: true } } },
    });

    if (!sub) {
      return {
        status: 'NONE',
        message: 'No subscription record found. Your role was assigned manually.',
      };
    }

    return {
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      graceDeadline: sub.graceDeadline,
      plan: sub.plan,
    };
  }

  // ─── Webhook: subscription.charged ───────────────────────────────────────────

  async handleCharged(razorpaySubscriptionId: string, currentPeriodEnd: Date): Promise<void> {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { razorpaySubscriptionId },
      include: { user: true },
    });
    if (!sub) {
      this.logger.warn(`subscription.charged: no record for ${razorpaySubscriptionId}`);
      return;
    }

    await this.prisma.distributorSubscription.update({
      where: { razorpaySubscriptionId },
      data: { status: 'ACTIVE', currentPeriodEnd, graceDeadline: null },
    });

    const user = sub.user;
    let distributorCode = user.distributorCode;
    if (!distributorCode) {
      distributorCode = await generateDistributorCode(this.prisma);
    }

    await this.prisma.user.update({
      where: { uuid: user.uuid },
      data: {
        role: UserRole.DISTRIBUTOR,
        distributorCode,
        joinLinkActive: true,
      },
    });

    this.audit.log({
      actorUuid: user.uuid,
      action: 'DISTRIBUTOR_SUBSCRIPTION_CHARGED',
      metadata: { razorpaySubscriptionId },
      ipAddress: 'webhook',
    });
  }

  // ─── Webhook: subscription.halted ────────────────────────────────────────────

  async handleHalted(razorpaySubscriptionId: string): Promise<void> {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { razorpaySubscriptionId },
      include: { user: true },
    });
    if (!sub) {
      this.logger.warn(`subscription.halted: no record for ${razorpaySubscriptionId}`);
      return;
    }

    const graceDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.distributorSubscription.update({
      where: { razorpaySubscriptionId },
      data: { status: 'HALTED', graceDeadline },
    });

    const graceFormatted = graceDeadline.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    this.mailService.sendSubscriptionWarningEmail(sub.user.email, sub.user.fullName, graceFormatted, 7);

    this.audit.log({
      actorUuid: sub.user.uuid,
      action: 'DISTRIBUTOR_SUBSCRIPTION_HALTED',
      metadata: { razorpaySubscriptionId, graceDeadline: graceDeadline.toISOString() },
      ipAddress: 'webhook',
    });
  }

  // ─── Webhook: subscription.cancelled / completed ─────────────────────────────

  async handleCancelledOrCompleted(razorpaySubscriptionId: string): Promise<void> {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { razorpaySubscriptionId },
      include: { user: true },
    });
    if (!sub) {
      this.logger.warn(`subscription.cancelled/completed: no record for ${razorpaySubscriptionId}`);
      return;
    }

    const graceDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.distributorSubscription.update({
      where: { razorpaySubscriptionId },
      data: { status: 'CANCELLED', graceDeadline },
    });

    const graceFormatted = graceDeadline.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    this.mailService.sendSubscriptionWarningEmail(sub.user.email, sub.user.fullName, graceFormatted, 7);

    this.audit.log({
      actorUuid: sub.user.uuid,
      action: 'DISTRIBUTOR_SUBSCRIPTION_CANCELLED_WEBHOOK',
      metadata: { razorpaySubscriptionId },
      ipAddress: 'webhook',
    });
  }
}
