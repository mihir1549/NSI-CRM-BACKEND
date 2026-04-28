import {
  Injectable,
  Logger,
  Inject,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CouponService } from '../coupon/coupon.service.js';
import { InvoiceService } from '../common/invoice/invoice.service.js';
import { CURRENT_TERMS_VERSION } from '../config/terms.config.js';
import { CreateOrderDto } from './payment.dto.js';
import { InvoicePdfService } from '../common/invoice/invoice-pdf.service.js';
import { MailService } from '../mail/mail.service.js';
import { PAYMENT_PROVIDER_TOKEN } from './providers/payment-provider.interface.js';
import type { PaymentProvider } from './providers/payment-provider.interface.js';
import { PaymentStatus, PaymentType, StepType } from '@prisma/client';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly couponService: CouponService,
    private readonly configService: ConfigService,
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly paymentProvider: PaymentProvider,
    private readonly invoiceService: InvoiceService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly mailService: MailService,
  ) {}

  // ─── CREATE ORDER ───────────────────────────────────────

   async createOrder(
    userUuid: string,
    dto: CreateOrderDto,
    ipAddress: string,
  ): Promise<
    | { orderId: string; amount: number; currency: string; keyId: string }
    | { freeAccess: true }
  > {
    // 0. Validate terms consent
    if (dto.termsAccepted !== true) {
      throw new BadRequestException('You must accept the terms and conditions');
    }

    if (dto.termsVersion !== CURRENT_TERMS_VERSION) {
      this.logger.warn(
        `Terms version mismatch for user ${userUuid}: received ${dto.termsVersion}, expected ${CURRENT_TERMS_VERSION}`,
      );
    }
    // 1. Check funnel progress: must have phoneVerified
    const progress = await this.prisma.funnelProgress.findUnique({
      where: { userUuid },
    });

    if (!progress?.phoneVerified) {
      throw new ForbiddenException(
        'Phone verification required before payment',
      );
    }

    if (progress.paymentCompleted) {
      throw new ConflictException('Payment already completed');
    }

    // 2. Verify user is currently at the PAYMENT_GATE step (security check)
    if (!progress.currentStepUuid) {
      throw new ForbiddenException('You must reach the payment step first');
    }

    const currentStep = await this.prisma.funnelStep.findUnique({
      where: { uuid: progress.currentStepUuid },
      include: { paymentGate: true },
    });

    if (!currentStep || currentStep.type !== StepType.PAYMENT_GATE) {
      throw new ForbiddenException('You must reach the payment step first');
    }

    const paymentGate = currentStep.paymentGate;
    if (!paymentGate) {
      throw new BadRequestException('Payment gate is not configured');
    }

    const originalAmount = Number(paymentGate.amount);
    const currency = paymentGate.currency;

    // 3. Validate and apply coupon inside a transaction (race condition protection)
    let mockWebhookOrderId: string | null = null;
    let mockWebhookPaymentUuid: string | null = null;

    const result = await this.prisma.$transaction(async (tx) => {
       let discountAmount = 0;
      let finalAmount = originalAmount;
      let couponUuid: string | undefined;

      if (dto.couponCode && paymentGate.allowCoupons) {
        const couponResult = await this.couponService.validateCouponInTx(
          dto.couponCode,
          userUuid,
          PaymentType.COMMITMENT_FEE,
          originalAmount,
          tx,
        );
        discountAmount = couponResult.discountAmount;
        finalAmount = couponResult.finalAmount;
        couponUuid = couponResult.coupon.uuid;
      }

      // 4. Handle FREE coupon (finalAmount = 0)
      if (finalAmount === 0) {
        // Create a synthetic payment record for FREE access
        const freePayment = await tx.payment.create({
          data: {
            userUuid,
            gatewayOrderId: `free_${Date.now()}_${userUuid.substring(0, 8)}`,
            amount: originalAmount,
            discountAmount,
            finalAmount: 0,
            currency,
             status: PaymentStatus.SUCCESS,
            paymentType: PaymentType.COMMITMENT_FEE,
            couponUuid: couponUuid ?? null,
            termsAcceptedAt: new Date(),
            termsVersion: dto.termsVersion,
            termsAcceptedIp: ipAddress,
          },
        });

        // Mark coupon as used
        if (couponUuid) {
          await tx.couponUse.create({
            data: { couponUuid, userUuid },
          });
          await tx.coupon.update({
            where: { uuid: couponUuid },
            data: { usedCount: { increment: 1 } },
          });
        }

        // Advance funnel progress
        const nextStep = await this.findNextStepFromCurrent(
          progress.currentStepUuid!,
          tx,
        );
        const progressUpdateData: Record<string, unknown> = {
          paymentCompleted: true,
          lastSeenAt: new Date(),
        };
        if (nextStep) {
          progressUpdateData.currentStepUuid = nextStep.uuid;
          progressUpdateData.currentSectionUuid = nextStep.sectionUuid;
        } else {
          progressUpdateData.currentStepUuid = null;
        }
        await tx.funnelProgress.update({
          where: { uuid: progress.uuid },
          data: progressUpdateData,
        });

        // Mark step as completed
        await tx.stepProgress.upsert({
          where: {
            funnelProgressUuid_stepUuid: {
              funnelProgressUuid: progress.uuid,
              stepUuid: progress.currentStepUuid!,
            },
          },
          create: {
            funnelProgressUuid: progress.uuid,
            stepUuid: progress.currentStepUuid!,
            isCompleted: true,
            completedAt: new Date(),
          },
          update: { isCompleted: true, completedAt: new Date() },
        });

        this.audit.log({
          actorUuid: userUuid,
          action: 'PAYMENT_FREE_ACCESS',
          metadata: {
            paymentUuid: freePayment.uuid,
            couponUuid: couponUuid ?? null,
          },
          ipAddress,
        });

        return { freeAccess: true } as const;
      }

      // 5. Create Razorpay order for non-zero amounts
      const paymentRecord = await tx.payment.create({
        data: {
          userUuid,
          gatewayOrderId: `pending_${Date.now()}`, // Temporary, updated below
          amount: originalAmount,
          discountAmount,
          finalAmount,
          currency,
           status: PaymentStatus.PENDING,
          paymentType: PaymentType.COMMITMENT_FEE,
          couponUuid: couponUuid ?? null,
          termsAcceptedAt: new Date(),
          termsVersion: dto.termsVersion,
          termsAcceptedIp: ipAddress,
        },
      });

      const order = await this.paymentProvider.createOrder(
        finalAmount,
        currency,
        paymentRecord.uuid,
      );

      // Update with real gatewayOrderId
      await tx.payment.update({
        where: { uuid: paymentRecord.uuid },
        data: { gatewayOrderId: order.orderId },
      });

      this.audit.log({
        actorUuid: userUuid,
        action: 'PAYMENT_ORDER_CREATED',
        metadata: {
          paymentUuid: paymentRecord.uuid,
          orderId: order.orderId,
          amount: finalAmount,
        },
        ipAddress,
      });

      const keyId = this.configService.get<string>(
        'RAZORPAY_KEY_ID',
        'rzp_test_mock',
      );

      // Capture for mock webhook outside transaction
      mockWebhookOrderId = order.orderId;
      mockWebhookPaymentUuid = paymentRecord.uuid;

      return { orderId: order.orderId, amount: finalAmount, currency, keyId };
    });

    // If mock mode: auto-trigger mock webhook AFTER transaction resolves successfully
    const smsProvider = this.configService.get<string>('SMS_PROVIDER', 'mock');
    const paymentProviderName = this.configService.get<string>(
      'PAYMENT_PROVIDER',
      'mock',
    );
    if (
      mockWebhookOrderId &&
      mockWebhookPaymentUuid &&
      (paymentProviderName === 'mock' || smsProvider === 'mock')
    ) {
      const oid = mockWebhookOrderId;
      const puid = mockWebhookPaymentUuid;
      setTimeout(() => {
        this.processMockWebhook(oid, puid).catch((err: Error) => {
          this.logger.error(`Mock webhook failed: ${err.message}`);
        });
      }, 2000);
    }

    return result;
  }

  // ─── HANDLE WEBHOOK ─────────────────────────────────────

  async handleWebhook(
    rawBody: string,
    signature: string,
    ipAddress: string,
  ): Promise<void> {
    // 1. Verify signature
    const isValid = this.paymentProvider.verifyWebhookSignature(
      rawBody,
      signature,
    );
    if (!isValid) {
      this.audit.log({
        action: 'WEBHOOK_INVALID_SIGNATURE',
        metadata: { ipAddress },
        ipAddress,
      });
      this.logger.warn(
        `[FRAUD ATTEMPT] Invalid webhook signature from IP: ${ipAddress}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Parse event
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const eventType = event['event'] as string;
    const payload = event['payload'] as Record<string, unknown> | undefined;
    const paymentEntity = (
      payload?.['payment'] as Record<string, unknown> | undefined
    )?.['entity'] as Record<string, unknown> | undefined;

    // 3. Handle payment.captured
    if (eventType === 'payment.captured' && paymentEntity) {
      const razorpayPaymentId = paymentEntity['id'] as string;
      const razorpayOrderId = paymentEntity['order_id'] as string;
      const webhookAmount = paymentEntity['amount'] as number;

      // Idempotency check: already processed?
      const alreadyProcessed = await this.prisma.payment.findUnique({
        where: { gatewayPaymentId: razorpayPaymentId },
      });
      if (alreadyProcessed) {
        this.logger.log(
          `Webhook already processed for paymentId=${razorpayPaymentId}`,
        );
        return; // Silent 200
      }

      // Find payment record by orderId
      const paymentRecord = await this.prisma.payment.findUnique({
        where: { gatewayOrderId: razorpayOrderId },
      });
      if (!paymentRecord) {
        this.logger.error(
          `Payment record not found for orderId=${razorpayOrderId}`,
        );
        return; // Never return non-200 to Razorpay
      }

      // Amount verification (fraud check)
      // webbookAmount is in PAISE, finalAmount is in RUPEES. Convert to Paise.
      const expectedAmountPaise = Math.round(
        Number(paymentRecord.finalAmount) * 100,
      );

      if (webhookAmount !== expectedAmountPaise) {
        this.audit.log({
          action: 'WEBHOOK_AMOUNT_MISMATCH',
          metadata: {
            orderId: razorpayOrderId,
            expectedAmount: paymentRecord.finalAmount,
            receivedAmount: webhookAmount,
            ipAddress,
          },
          ipAddress,
        });
        this.logger.warn(
          `[FRAUD ATTEMPT] Webhook amount mismatch: orderId=${razorpayOrderId} expected=${paymentRecord.finalAmount} received=${webhookAmount}`,
        );
        return; // Do NOT mark as paid
      }

      // Update payment and advance funnel
      await this.processSuccessfulPayment(
        paymentRecord.uuid,
        razorpayPaymentId,
        ipAddress,
      );
    }

    // 4. Handle payment.failed
    if (eventType === 'payment.failed' && paymentEntity) {
      const razorpayOrderId = paymentEntity['order_id'] as string;
      const errorReason =
        (paymentEntity['error_reason'] as string) ?? 'unknown';

      await this.prisma.payment.updateMany({
        where: {
          gatewayOrderId: razorpayOrderId,
          status: PaymentStatus.PENDING,
        },
        data: { status: PaymentStatus.FAILED },
      });

      this.logger.warn(
        `Payment failed for orderId=${razorpayOrderId} reason=${errorReason}`,
      );
    }
  }

  // ─── GET PAYMENT STATUS ─────────────────────────────────

  async getStatus(userUuid: string) {
    const progress = await this.prisma.funnelProgress.findUnique({
      where: { userUuid },
    });

    const payment = await this.prisma.payment.findFirst({
      where: { userUuid, status: PaymentStatus.SUCCESS },
      orderBy: { createdAt: 'desc' },
    });

    return {
      paymentCompleted: progress?.paymentCompleted ?? false,
      payment: payment
        ? {
            uuid: payment.uuid,
            gatewayOrderId: payment.gatewayOrderId,
            amount: payment.amount,
            discountAmount: payment.discountAmount,
            finalAmount: payment.finalAmount,
            currency: payment.currency,
            status: payment.status,
            paymentType: payment.paymentType,
            createdAt: payment.createdAt,
          }
        : null,
    };
  }

  // ─── INTERNAL: PROCESS SUCCESSFUL PAYMENT ───────────────

  async processSuccessfulPayment(
    paymentUuid: string,
    gatewayPaymentId: string,
    ipAddress: string,
  ): Promise<void> {
    const paymentRecord = await this.prisma.payment.findUnique({
      where: { uuid: paymentUuid },
    });

    if (!paymentRecord) {
      throw new NotFoundException('Payment record not found');
    }

    // ─── LMS_COURSE: create enrollment ────────────────────
    if (paymentRecord.paymentType === PaymentType.LMS_COURSE) {
      const metadata = paymentRecord.metadata as Record<string, unknown> | null;
      const courseUuid = metadata?.['courseUuid'] as string | undefined;

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { uuid: paymentUuid },
          data: { gatewayPaymentId, status: PaymentStatus.SUCCESS },
        });

        if (courseUuid) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).courseEnrollment.create({
              data: { userUuid: paymentRecord.userUuid, courseUuid },
            });
          } catch {
            // @@unique — already enrolled, idempotent
          }
        }
      });

      this.audit.log({
        actorUuid: paymentRecord.userUuid,
        action: 'LMS_PAYMENT_SUCCESS',
        metadata: {
          paymentUuid,
          gatewayPaymentId,
          courseUuid: courseUuid ?? null,
        },
        ipAddress,
      });

      this.logger.log(
        `LMS payment success: paymentUuid=${paymentUuid} course=${courseUuid ?? 'unknown'}`,
      );

      // Invoice generation for LMS_COURSE — fire-and-forget
      try {
        const user = await this.prisma.user.findUnique({
          where: { uuid: paymentRecord.userUuid },
          select: { fullName: true, email: true },
        });

        let planName = 'LMS Course';
        if (courseUuid) {
          const course = await this.prisma.course.findUnique({
            where: { uuid: courseUuid },
            select: { title: true },
          });
          if (course?.title) planName = course.title;
        }

        if (user) {
          const invoiceNumber =
            await this.invoiceService.generateInvoiceNumber();
          await this.prisma.payment.update({
            where: { uuid: paymentUuid },
            data: { invoiceNumber },
          });

          // Fire-and-forget PDF + email
          this.invoicePdfService
            .generateAndUpload({
              invoiceNumber,
              invoiceDate: new Date(),
              fullName: user.fullName,
              email: user.email,
              planName,
              amount: Number(paymentRecord.finalAmount),
              currency: 'INR',
              nextBillingDate: null,
            })
            .then(async (invoiceUrl) => {
              if (invoiceUrl) {
                await this.prisma.payment.update({
                  where: { uuid: paymentUuid },
                  data: { invoiceUrl },
                });
              }
              this.mailService.sendSubscriptionInvoiceEmail(user.email, {
                fullName: user.fullName,
                invoiceNumber,
                amount: Number(paymentRecord.finalAmount),
                planName,
                billingDate: new Date().toISOString(),
                nextBillingDate: '',
                invoiceUrl: invoiceUrl ?? null,
              });
            })
            .catch((err) => {
              this.logger.error(`LMS invoice generation failed: ${err.message}`);
            });
        }
      } catch (err) {
        this.logger.error(`LMS invoice setup failed: ${err.message}`);
      }

      return;
    }

    // ─── COMMITMENT_FEE / other: advance funnel ────────────
    const progress = await this.prisma.funnelProgress.findUnique({
      where: { userUuid: paymentRecord.userUuid },
    });

    if (!progress) {
      this.logger.error(
        `FunnelProgress not found for user=${paymentRecord.userUuid}`,
      );
      return;
    }

    // Find the step that was being completed (the PAYMENT_GATE step)
    const paymentStep = await this.prisma.funnelStep.findFirst({
      where: { type: StepType.PAYMENT_GATE, isActive: true },
    });

    const stepToComplete = progress.currentStepUuid ?? paymentStep?.uuid;

    await this.prisma.$transaction(async (tx) => {
      // Update payment record
      await tx.payment.update({
        where: { uuid: paymentUuid },
        data: { gatewayPaymentId, status: PaymentStatus.SUCCESS },
      });

      // Mark coupon as used if applicable
      if (paymentRecord.couponUuid) {
        try {
          await tx.couponUse.create({
            data: {
              couponUuid: paymentRecord.couponUuid,
              userUuid: paymentRecord.userUuid,
            },
          });
          await tx.coupon.update({
            where: { uuid: paymentRecord.couponUuid },
            data: { usedCount: { increment: 1 } },
          });
        } catch {
          // @@unique constraint — already created, ignore
        }
      }

      // Advance funnel progress
      const nextStep = stepToComplete
        ? await this.findNextStepFromCurrent(stepToComplete, tx)
        : null;

      const progressUpdate: Record<string, unknown> = {
        paymentCompleted: true,
        lastSeenAt: new Date(),
      };
      if (nextStep) {
        progressUpdate.currentStepUuid = nextStep.uuid;
        progressUpdate.currentSectionUuid = nextStep.sectionUuid;
      } else {
        progressUpdate.currentStepUuid = null;
      }

      await tx.funnelProgress.update({
        where: { uuid: progress.uuid },
        data: progressUpdate,
      });

      // Mark step as completed
      if (stepToComplete) {
        await tx.stepProgress.upsert({
          where: {
            funnelProgressUuid_stepUuid: {
              funnelProgressUuid: progress.uuid,
              stepUuid: stepToComplete,
            },
          },
          create: {
            funnelProgressUuid: progress.uuid,
            stepUuid: stepToComplete,
            isCompleted: true,
            completedAt: new Date(),
          },
          update: { isCompleted: true, completedAt: new Date() },
        });
      }
    });

    this.audit.log({
      actorUuid: paymentRecord.userUuid,
      action: 'PAYMENT_SUCCESS',
      metadata: { paymentUuid, gatewayPaymentId },
      ipAddress,
    });

    this.logger.log(
      `Payment success: paymentUuid=${paymentUuid} gatewayPaymentId=${gatewayPaymentId}`,
    );

    // Generate invoice number + PDF for COMMITMENT_FEE
    if (paymentRecord.paymentType === PaymentType.COMMITMENT_FEE) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { uuid: paymentRecord.userUuid },
          select: { fullName: true, email: true },
        });
        if (user) {
          const invoiceNumber =
            await this.invoiceService.generateInvoiceNumber();
          await this.prisma.payment.update({
            where: { uuid: paymentUuid },
            data: { invoiceNumber },
          });

          // Fire-and-forget PDF generation
          this.invoicePdfService
            .generateAndUpload({
              invoiceNumber,
              invoiceDate: new Date(),
              fullName: user.fullName,
              email: user.email,
              planName: 'Commitment Fee',
              amount: paymentRecord.finalAmount,
              currency: 'INR',
              nextBillingDate: null,
            })
            .then(async (invoiceUrl) => {
              if (invoiceUrl) {
                await this.prisma.payment
                  .update({
                    where: { uuid: paymentUuid },
                    data: { invoiceUrl },
                  })
                  .catch((err) =>
                    this.logger.error(
                      'Failed to save commitment fee invoiceUrl:',
                      err,
                    ),
                  );
              }
              // Send invoice email (fire-and-forget)
              this.mailService.sendSubscriptionInvoiceEmail(user.email, {
                fullName: user.fullName,
                invoiceNumber,
                amount: Number(paymentRecord.finalAmount),
                planName: 'Commitment Fee',
                billingDate: new Date().toISOString(),
                nextBillingDate: '',
                invoiceUrl: invoiceUrl ?? null,
              });
            })
            .catch((err) =>
              this.logger.error('Commitment fee invoice PDF error:', err),
            );
        }
      } catch (err) {
        this.logger.error(
          `Failed to generate commitment fee invoice: ${(err as Error).message}`,
        );
      }
    }
  }

  // ─── PRIVATE: MOCK WEBHOOK ───────────────────────────────

  private async processMockWebhook(
    orderId: string,
    paymentUuid: string,
  ): Promise<void> {
    this.logger.log(
      `[MOCK PAYMENT] Auto-triggering webhook for orderId=${orderId}`,
    );
    const mockPaymentId = `mock_pay_${Date.now()}`;
    await this.processSuccessfulPayment(paymentUuid, mockPaymentId, 'mock');
  }

  // ─── PRIVATE: FIND NEXT STEP ─────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async findNextStepFromCurrent(currentStepUuid: string, tx?: any) {
    const db = tx ?? this.prisma;
    const currentStep = await db.funnelStep.findUnique({
      where: { uuid: currentStepUuid },
    });
    if (!currentStep) return null;

    const nextInSection = await db.funnelStep.findFirst({
      where: {
        sectionUuid: currentStep.sectionUuid,
        isActive: true,
        order: { gt: currentStep.order },
      },
      orderBy: { order: 'asc' },
    });
    if (nextInSection) return nextInSection;

    const currentSection = await db.funnelSection.findUnique({
      where: { uuid: currentStep.sectionUuid },
    });
    if (!currentSection) return null;

    const nextSection = await db.funnelSection.findFirst({
      where: { isActive: true, order: { gt: currentSection.order } },
      orderBy: { order: 'asc' },
      include: {
        steps: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
    });

    return (nextSection as any)?.steps[0] ?? null;
  }
}
