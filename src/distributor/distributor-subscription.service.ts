import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { InvoiceService } from '../common/invoice/invoice.service.js';
import { InvoicePdfService } from '../common/invoice/invoice-pdf.service.js';
import { DistributorSubscriptionHistoryService } from './distributor-subscription-history.service.js';
import {
  UserRole,
  UserStatus,
  LeadStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
} from '@prisma/client';
 import { generateDistributorCode } from './distributor-code.helper.js';
import { v4 as uuidv4 } from 'uuid';
import { CURRENT_TERMS_VERSION } from '../config/terms.config.js';
import type { SubscriptionQueryDto } from './dto/subscription-query.dto.js';
import type { SubscribeDto } from './dto/subscribe.dto.js';
import { CouponService } from '../coupon/coupon.service.js';

@Injectable()
export class DistributorSubscriptionService {
  private readonly logger = new Logger(DistributorSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mailService: MailService,
    private readonly invoiceService: InvoiceService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly historyService: DistributorSubscriptionHistoryService,
    private readonly couponService: CouponService,
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
          user: {
            select: {
              uuid: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
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
        user: {
          select: { uuid: true, fullName: true, email: true, avatarUrl: true },
        },
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

    const isMock =
      this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    if (!isMock) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
        key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
      });
      try {
        await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId);
      } catch (error) {
        this.logger.error(
          'Razorpay cancel subscription failed',
          (error as Error)?.message,
        );
        throw new ServiceUnavailableException(
          'Payment service temporarily unavailable. Please try again.',
        );
      }
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
      const statusFilter = {
        in: [
          LeadStatus.NEW,
          LeadStatus.WARM,
          LeadStatus.HOT,
          LeadStatus.CONTACTED,
          LeadStatus.FOLLOWUP,
          LeadStatus.NURTURE,
        ],
      };

      const affectedLeads = await this.prisma.lead.findMany({
        where: { distributorUuid: sub.userUuid, status: statusFilter },
        select: { userUuid: true },
      });

      const result = await this.prisma.lead.updateMany({
        where: { distributorUuid: sub.userUuid, status: statusFilter },
        data: { assignedToUuid: superAdmin.uuid },
      });
      leadsReassigned = result.count;

      const affectedUserUuids = affectedLeads.map((l) => l.userUuid);
      if (affectedUserUuids.length > 0) {
        await this.prisma.userAcquisition.updateMany({
          where: { userUuid: { in: affectedUserUuids } },
          data: { distributorUuid: superAdmin.uuid },
        });
      }
    }

    // Fire-and-forget history log
    this.historyService.log({
      userUuid: sub.userUuid,
      event: 'ADMIN_CANCELLED',
      notes: 'Cancelled by Super Admin',
    });

    // Fire-and-forget email
    this.mailService.sendSubscriptionCancelledByAdminEmail(
      sub.user.email,
      sub.user.fullName,
    );

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
 
   async subscribe(userUuid: string, dto: SubscribeDto, ipAddress: string) {
    // Check existing subscription FIRST — before any other logic
    const existing = await this.prisma.distributorSubscription.findUnique({
      where: { userUuid },
    });

    if (existing) {
      if (existing.status === 'HALTED') {
        const url = await this.getShortUrlForSubscription(
          existing.razorpaySubscriptionId,
        );
        throw new BadRequestException({
          message:
            'Your subscription payment failed. Please update your payment method.',
          paymentMethodUrl: url,
        });
      }
      if (existing.status === 'ACTIVE' || existing.status === 'GRACE') {
        throw new BadRequestException(
          'You already have an active subscription.',
        );
      }
       // CANCELLED or EXPIRED → fall through, but check cooldown
      if (
        existing.status === 'CANCELLED' &&
        existing.currentPeriodEnd > new Date()
      ) {
        throw new BadRequestException(
          `You can re-subscribe after your current period ends on ${existing.currentPeriodEnd.toDateString()}.`,
        );
      }
    }

    // 0. Validate terms consent
    if (dto.termsAccepted !== true) {
      throw new BadRequestException('You must accept the terms and conditions');
    }

    if (dto.termsVersion !== CURRENT_TERMS_VERSION) {
      this.logger.warn(
        `Terms version mismatch for user ${userUuid}: received ${dto.termsVersion}, expected ${CURRENT_TERMS_VERSION}`,
      );
    }

    // Determine if this is a re-subscribe
    const isResubscribe =
      existing !== null &&
      (existing.status === 'CANCELLED' || existing.status === 'EXPIRED');

    // Validate plan
    const plan = await this.prisma.distributorPlan.findUnique({
      where: { uuid: dto.planUuid },
    });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Plan not found or is no longer active');
    }

    // Resolve coupon before creating the Razorpay subscription
    let finalAmount = Math.round(Number(plan.amount));
    let discountAmount = 0;
    let couponUuid: string | undefined;

    if (dto.couponCode) {
      try {
        const couponResult = await this.couponService.validateCouponInTx(
          dto.couponCode,
          userUuid,
          PaymentType.DISTRIBUTOR_SUB,
          finalAmount,
          this.prisma,
        );
        discountAmount = couponResult.discountAmount;
        finalAmount = couponResult.finalAmount;
        couponUuid = couponResult.coupon.uuid;
      } catch (e) {
        throw new BadRequestException(
          (e as Error)?.message ?? 'Invalid or inapplicable coupon code',
        );
      }
    }

    const isMock =
      this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    let razorpaySubscriptionId: string;
    let shortUrl: string | null = null;

    if (isMock) {
      razorpaySubscriptionId = `mock_sub_${uuidv4()}`;

      // Fire-and-forget mock activation after 2 seconds
      const subId = razorpaySubscriptionId;
      const planId = plan.uuid;
       setTimeout(() => {
        this.activateMockSubscription(
          userUuid,
          subId,
          planId,
          isResubscribe,
          dto,
          ipAddress,
          discountAmount,
          finalAmount,
          couponUuid,
        ).catch((err: Error) => {
          this.logger.error(
            `Mock subscription activation failed: ${err.message}`,
          );
        });
      }, 2000);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
        key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
      });
      try {
         const sub = await razorpay.subscriptions.create({
          plan_id: plan.razorpayPlanId,
          total_count: 12, // 12 monthly cycles
          customer_notify: 1,
          notes: {
            termsAcceptedAt: new Date().toISOString(),
            termsVersion: dto.termsVersion,
            termsAcceptedIp: ipAddress,
          },
        });
        razorpaySubscriptionId = sub.id;
        shortUrl = sub.short_url ?? null;
      } catch (error) {
        this.logger.error(
          'Razorpay create subscription failed',
          (error as Error)?.message,
        );
        throw new ServiceUnavailableException(
          'Payment service temporarily unavailable. Please try again.',
        );
      }
    }

    // ── Create DB record so webhooks can find this subscription ──────────────
    const now = new Date();
    const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.distributorSubscription.upsert({
      where: { userUuid },
      create: {
        userUuid,
        planUuid: plan.uuid,
        razorpaySubscriptionId,
        status: 'ACTIVE',
        currentPeriodEnd,
        graceDeadline: null,
        cancelledAt: null,
      },
      update: {
        planUuid: plan.uuid,
        razorpaySubscriptionId,
        status: 'ACTIVE',
        currentPeriodEnd,
        graceDeadline: null,
        cancelledAt: null,
        migrationPending: false,
        planDeactivatedAt: null,
      },
    });

    // ── Upgrade user to DISTRIBUTOR role ─────────────────────────────────────
    const user = await this.prisma.user.findUnique({
      where: { uuid: userUuid },
    });
    if (user) {
      const distributorCode =
        user.distributorCode ?? (await generateDistributorCode(this.prisma));

      await this.prisma.user.update({
        where: { uuid: userUuid },
        data: {
          role: UserRole.DISTRIBUTOR,
          distributorCode,
          joinLinkActive: true,
        },
      });

      // Fire-and-forget history log
      this.historyService.log({
        userUuid,
        planUuid: plan.uuid,
        razorpaySubscriptionId,
        event: isResubscribe ? 'RESUBSCRIBED' : 'SUBSCRIBED',
        amount: plan.amount,
        notes: isResubscribe ? 'Re-subscribed' : 'First subscription activated',
      });
    }

    return {
      subscriptionId: razorpaySubscriptionId,
      shortUrl,
      key: this.config.get<string>('RAZORPAY_KEY_ID', ''),
    };
  }

  /**
   * Fire-and-forget mock subscription activation (called after 2s delay).
   */
   private async activateMockSubscription(
    userUuid: string,
    razorpaySubscriptionId: string,
    planUuid: string,
    isResubscribe: boolean,
    dto: SubscribeDto,
    ipAddress: string,
    discountAmount: number = 0,
    finalAmount?: number,
    couponUuid?: string,
  ): Promise<void> {
    const now = new Date();
    const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Upsert subscription record
    const subscription = await this.prisma.distributorSubscription.upsert({
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
        migrationPending: false,
        planDeactivatedAt: null,
      },
    });

    // Upgrade user role
    const user = await this.prisma.user.findUnique({
      where: { uuid: userUuid },
    });
    if (!user) return;

    const distributorCode =
      user.distributorCode ?? (await generateDistributorCode(this.prisma));

    await this.prisma.user.update({
      where: { uuid: userUuid },
      data: {
        role: UserRole.DISTRIBUTOR,
        distributorCode,
        joinLinkActive: true,
      },
    });

    // Create payment record for mock subscription
    const plan = await this.prisma.distributorPlan.findUnique({
      where: { uuid: planUuid },
    });
    if (plan) {
      const invoiceNumber = await this.invoiceService.generateInvoiceNumber();
      const mockPaymentId = `mock_payment_${uuidv4()}`;
      const baseAmount = Math.round(plan.amount);
      const effectiveFinalAmount = finalAmount ?? baseAmount;
      const effectiveDiscountAmount = discountAmount;

      const payment = await this.prisma.payment.create({
        data: {
          userUuid,
          gatewayPaymentId: mockPaymentId,
          invoiceNumber,
          amount: baseAmount,
          discountAmount: effectiveDiscountAmount,
          finalAmount: effectiveFinalAmount,
          currency: 'INR',
          status: PaymentStatus.SUCCESS,
           paymentType: PaymentType.DISTRIBUTOR_SUB,
          couponUuid: couponUuid ?? null,
          metadata: {
            subscriptionId: razorpaySubscriptionId,
            planName: plan.name,
            billingCycle: currentPeriodEnd.toISOString(),
          },
          termsAcceptedAt: new Date(),
          termsVersion: dto.termsVersion,
          termsAcceptedIp: ipAddress,
        },
      });

      // Increment coupon usedCount on successful mock payment
      if (couponUuid) {
        try {
          await this.prisma.couponUse.create({
            data: { couponUuid, userUuid },
          });
          await this.prisma.coupon.update({
            where: { uuid: couponUuid },
            data: { usedCount: { increment: 1 } },
          });
        } catch {
          // @@unique constraint — already incremented (idempotent)
        }
      }

      // Fire-and-forget history log
      this.historyService.log({
        userUuid: user.uuid,
        planUuid: subscription.planUuid,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        event: isResubscribe ? 'RESUBSCRIBED' : 'SUBSCRIBED',
        amount: plan.amount,
        invoiceNumber,
        notes: isResubscribe ? 'Re-subscribed' : 'First subscription activated',
      });

      const frontendUrl = this.config.get<string>(
        'FRONTEND_URL',
        'https://growithnsi.com',
      );
      const joinLink = `${frontendUrl}/join/${distributorCode}`;

      // Fire-and-forget invoice email
      this.mailService.sendSubscriptionInvoiceEmail(user.email, {
        fullName: user.fullName,
        invoiceNumber,
        amount: baseAmount,
        planName: plan.name,
        billingDate: now.toISOString(),
        nextBillingDate: currentPeriodEnd.toISOString(),
        invoiceUrl: null,
      });

      // Fire-and-forget invoice PDF generation — then save invoiceUrl on payment
      this.invoicePdfService
        .generateAndUpload({
          invoiceNumber,
          invoiceDate: now,
          fullName: user.fullName,
          email: user.email,
          planName: plan.name,
          amount: baseAmount,
          currency: 'INR',
          nextBillingDate: currentPeriodEnd,
          accountLabel: 'Distributor Account',
        })
        .then(async (invoiceUrl) => {
          if (invoiceUrl) {
            await this.prisma.payment
              .update({
                where: { uuid: payment.uuid },
                data: { invoiceUrl },
              })
              .catch((err) =>
                this.logger.error('Failed to save invoiceUrl:', err),
              );
          }
        })
        .catch((err) =>
          this.logger.error('Invoice PDF generation error:', err),
        );

      // Send subscription email (active or reactivated)
      if (isResubscribe) {
        this.mailService.sendSubscriptionReactivatedEmail(user.email, {
          fullName: user.fullName,
          planName: plan.name,
          amount: baseAmount,
          nextBillingDate: currentPeriodEnd.toISOString(),
          joinLink,
        });
      } else {
        this.mailService.sendSubscriptionActiveEmail(user.email, {
          fullName: user.fullName,
          planName: plan.name,
          amount: baseAmount,
          nextBillingDate: currentPeriodEnd.toISOString(),
          joinLink,
        });
      }
    }
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
        message:
          'No subscription record found. Your role was assigned manually.',
      };
    }

    return {
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      graceDeadline: sub.graceDeadline,
      migrationPending: sub.migrationPending,
      planDeactivatedAt: sub.planDeactivatedAt,
      plan: sub.plan,
    };
  }

  // ─── Self-service: self-cancel subscription ──────────────────────────────────

  async selfCancelSubscription(
    userUuid: string,
  ): Promise<{ message: string; accessUntil: Date }> {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { userUuid },
      include: { plan: { select: { name: true } } },
    });

    if (!sub) {
      throw new NotFoundException('No subscription found.');
    }

    if (sub.status === 'HALTED') {
      throw new BadRequestException(
        'Your payment is pending. Please update your payment method instead of cancelling.',
      );
    }

    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
      throw new BadRequestException('No active subscription found.');
    }

    // ACTIVE or GRACE — proceed with cancellation
    const isMock =
      this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    if (!isMock) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
        key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
      });
      try {
        await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, {
          cancel_at_cycle_end: 1,
        });
      } catch (error) {
        this.logger.error(
          'Razorpay self-cancel subscription failed',
          (error as Error)?.message,
        );
        throw new ServiceUnavailableException(
          'Payment service temporarily unavailable. Please try again.',
        );
      }
    }

    await this.prisma.distributorSubscription.update({
      where: { userUuid },
      data: { status: 'CANCELLED' },
    });

    // Fire-and-forget history log
    this.historyService.log({
      userUuid,
      event: 'SELF_CANCELLED',
      notes: `Access continues until ${sub.currentPeriodEnd}`,
    });

    const accessUntil = sub.currentPeriodEnd;

    // Fire-and-forget self-cancelled email
    const user = await this.prisma.user.findUnique({
      where: { uuid: userUuid },
      select: { email: true, fullName: true },
    });
    if (user) {
      this.mailService.sendSubscriptionSelfCancelledEmail(user.email, {
        fullName: user.fullName,
        accessUntil: accessUntil.toISOString(),
        planName: sub.plan.name,
      });
    }

    return {
      message: `Subscription cancelled. Access continues until ${accessUntil.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
      accessUntil,
    };
  }

  // ─── Self-service: get payment method update URL ─────────────────────────────

  async getPaymentMethodUrl(userUuid: string): Promise<{ url: string }> {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { userUuid },
    });

    if (!sub || sub.status !== 'HALTED') {
      throw new BadRequestException(
        'No payment issue found on your subscription.',
      );
    }

    const url = await this.getShortUrlForSubscription(
      sub.razorpaySubscriptionId,
    );
    return { url };
  }

  // ─── Webhook: subscription.charged ───────────────────────────────────────────

   async handleCharged(
    razorpaySubscriptionId: string,
    currentPeriodEnd: Date,
    razorpayPaymentId?: string,
    notes?: Record<string, any>,
  ): Promise<void> {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { razorpaySubscriptionId },
      include: { user: true, plan: true },
    });
    if (!sub) {
      this.logger.warn(
        `subscription.charged: no record for ${razorpaySubscriptionId}`,
      );
      return;
    }

    // B4: Idempotency check — skip if this payment was already processed
    if (razorpayPaymentId) {
      const existing = await this.prisma.payment.findFirst({
        where: { gatewayPaymentId: razorpayPaymentId },
      });
      if (existing) {
        this.logger.log(
          `[handleCharged] Duplicate webhook skipped: ${razorpayPaymentId}`,
        );
        return;
      }
    }

    try {
      await this.prisma.distributorSubscription.update({
        where: { razorpaySubscriptionId },
        data: { status: 'ACTIVE', currentPeriodEnd, graceDeadline: null },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(
          `handleCharged: subscription ${razorpaySubscriptionId} not found for update`,
        );
        return;
      }
      throw error;
    }

    const user = sub.user;
    let distributorCode = user.distributorCode;
    if (!distributorCode) {
      distributorCode = await generateDistributorCode(this.prisma);
    }

    // B6: Never upgrade role for a suspended user
    if (user.status !== UserStatus.SUSPENDED) {
      await this.prisma.user.update({
        where: { uuid: user.uuid },
        data: {
          role: UserRole.DISTRIBUTOR,
          distributorCode,
          joinLinkActive: true,
        },
      });
    } else {
      this.logger.warn(
        `[handleCharged] Skipping role upgrade — user ${user.uuid} is SUSPENDED`,
      );
    }

    // Create payment record
    const plan = sub.plan;
    const invoiceNumber = await this.invoiceService.generateInvoiceNumber();
    const amount = Math.round(plan.amount);
    const now = new Date();

    const payment = await this.prisma.payment.create({
      data: {
        userUuid: user.uuid,
        gatewayPaymentId: razorpayPaymentId ?? undefined,
        invoiceNumber,
        amount,
        discountAmount: 0,
        finalAmount: amount,
        currency: 'INR',
        status: PaymentStatus.SUCCESS,
        paymentType: PaymentType.DISTRIBUTOR_SUB,
         metadata: {
          subscriptionId: razorpaySubscriptionId,
          planName: plan.name,
          billingCycle: currentPeriodEnd.toISOString(),
        },
        termsAcceptedAt: notes?.termsAcceptedAt ? new Date(notes.termsAcceptedAt) : new Date(),
        termsVersion: notes?.termsVersion ?? null,
        termsAcceptedIp: notes?.termsAcceptedIp ?? 'webhook',
      },
    });

    // Fire-and-forget history log
    this.historyService.log({
      userUuid: user.uuid,
      planUuid: sub.planUuid,
      razorpaySubscriptionId: sub.razorpaySubscriptionId,
      event: 'CHARGED',
      amount: plan.amount,
      invoiceNumber,
      notes: 'Monthly renewal payment successful',
    });

    // Fire-and-forget invoice email
    this.mailService.sendSubscriptionInvoiceEmail(user.email, {
      fullName: user.fullName,
      invoiceNumber,
      amount,
      planName: plan.name,
      billingDate: now.toISOString(),
      nextBillingDate: currentPeriodEnd.toISOString(),
      invoiceUrl: null,
    });

    // Fire-and-forget invoice PDF generation — then save invoiceUrl on payment
    this.invoicePdfService
      .generateAndUpload({
        invoiceNumber,
        invoiceDate: now,
        fullName: user.fullName,
        email: user.email,
        planName: plan.name,
        amount,
        currency: 'INR',
        nextBillingDate: currentPeriodEnd,
        accountLabel: 'Distributor Account',
      })
      .then(async (invoiceUrl) => {
        if (invoiceUrl) {
          await this.prisma.payment
            .update({
              where: { uuid: payment.uuid },
              data: { invoiceUrl },
            })
            .catch((err) =>
              this.logger.error('Failed to save invoiceUrl:', err),
            );
        }
      })
      .catch((err) => this.logger.error('Invoice PDF generation error:', err));

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
      this.logger.warn(
        `subscription.halted: no record for ${razorpaySubscriptionId}`,
      );
      return;
    }

    const graceDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      await this.prisma.distributorSubscription.update({
        where: { razorpaySubscriptionId },
        data: { status: 'HALTED', graceDeadline },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(
          `handleHalted: subscription ${razorpaySubscriptionId} not found for update`,
        );
        return;
      }
      throw error;
    }

    const paymentMethodUrl = await this.getShortUrlForSubscription(
      razorpaySubscriptionId,
    );
    const graceFormatted = graceDeadline.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    this.mailService.sendSubscriptionWarningEmail(sub.user.email, {
      fullName: sub.user.fullName,
      graceDeadline: graceFormatted,
      paymentMethodUrl,
    });

    this.audit.log({
      actorUuid: sub.user.uuid,
      action: 'DISTRIBUTOR_SUBSCRIPTION_HALTED',
      metadata: {
        razorpaySubscriptionId,
        graceDeadline: graceDeadline.toISOString(),
      },
      ipAddress: 'webhook',
    });
  }

  // ─── Webhook: subscription.cancelled / completed ─────────────────────────────

  async handleCancelledOrCompleted(
    razorpaySubscriptionId: string,
  ): Promise<void> {
    const sub = await this.prisma.distributorSubscription.findUnique({
      where: { razorpaySubscriptionId },
      include: { user: true },
    });
    if (!sub) {
      this.logger.warn(
        `subscription.cancelled/completed: no record for ${razorpaySubscriptionId}`,
      );
      return;
    }

    const graceDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      await this.prisma.distributorSubscription.update({
        where: { razorpaySubscriptionId },
        data: { status: 'CANCELLED', graceDeadline },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(
          `handleCancelledOrCompleted: subscription ${razorpaySubscriptionId} not found for update`,
        );
        return;
      }
      throw error;
    }

    // B3: If grace period has already passed (or was never set), downgrade role immediately.
    // Normally graceDeadline is 7 days from now, so the cron handles expiry after grace.
    // This branch is a safety net for edge cases where grace is null or already expired.
    const now = new Date();
    if (!graceDeadline || graceDeadline <= now) {
      await this.prisma.user.update({
        where: { uuid: sub.user.uuid },
        data: { role: UserRole.CUSTOMER },
      });
      this.logger.log(
        `[handleCancelledOrCompleted] Role downgraded to CUSTOMER for user ${sub.user.uuid}`,
      );
    }
    // else: grace period active — cron (distributor-cron.service.ts) will downgrade
    // role and reassign leads once graceDeadline passes

    const paymentMethodUrl = await this.getShortUrlForSubscription(
      razorpaySubscriptionId,
    );
    const graceFormatted = graceDeadline.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    this.mailService.sendSubscriptionWarningEmail(sub.user.email, {
      fullName: sub.user.fullName,
      graceDeadline: graceFormatted,
      paymentMethodUrl,
    });

    this.audit.log({
      actorUuid: sub.user.uuid,
      action: 'DISTRIBUTOR_SUBSCRIPTION_CANCELLED_WEBHOOK',
      metadata: { razorpaySubscriptionId },
      ipAddress: 'webhook',
    });
  }

  // ─── Private: get short URL for subscription ─────────────────────────────────

  private async getShortUrlForSubscription(
    razorpaySubscriptionId: string,
  ): Promise<string> {
    const isMock =
      this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    if (isMock) {
      return 'https://mock-razorpay.com/update-payment';
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
    });
    try {
      const sub = await razorpay.subscriptions.fetch(razorpaySubscriptionId);
      return sub.short_url as string;
    } catch (error) {
      this.logger.error(
        'Razorpay fetch subscription failed',
        (error as Error)?.message,
      );
      throw new ServiceUnavailableException(
        'Payment service temporarily unavailable. Please try again.',
      );
    }
  }
}
