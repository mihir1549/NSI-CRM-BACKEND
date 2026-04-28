import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { PAYMENT_PROVIDER_TOKEN } from '../payment/providers/payment-provider.interface.js';
import type { PaymentProvider } from '../payment/providers/payment-provider.interface.js';
import { PaymentStatus, PaymentType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CURRENT_TERMS_VERSION } from '../config/terms.config.js';
import { CouponService } from '../coupon/coupon.service.js';
import { EnrollDto } from './dto/enroll.dto.js';

/**
 * EnrollmentService — handles course enrollment for free and paid courses.
 * For paid courses, creates a Razorpay order and returns it to the frontend.
 * The payment webhook (in PaymentService) creates the enrollment on payment success.
 */
@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly paymentProvider: PaymentProvider,
    private readonly couponService: CouponService,
  ) {}

  /**
   * Enroll a user in a free course.
   */
  async enrollFree(
    userUuid: string,
    courseUuid: string,
  ): Promise<{ enrolled: boolean; message: string }> {
    const course = await this.prisma.course.findUnique({
      where: { uuid: courseUuid },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (!course.isPublished)
      throw new BadRequestException('Course is not published');
    if (!course.isFree)
      throw new BadRequestException(
        'This is a paid course. Use the payment flow to enroll.',
      );

    const existing = await this.prisma.courseEnrollment.findUnique({
      where: { userUuid_courseUuid: { userUuid, courseUuid } },
    });
    if (existing)
      throw new ConflictException('Already enrolled in this course');

    await this.prisma.courseEnrollment.create({
      data: { userUuid, courseUuid },
    });

    this.logger.log(`Free enrollment: user=${userUuid} course=${courseUuid}`);
    return { enrolled: true, message: 'Enrolled successfully' };
  }

  /**
   * Initiate paid enrollment — creates a Razorpay order.
   * Frontend opens Razorpay checkout with the returned order details.
   * Actual enrollment is created by the payment webhook on success.
   */
   async initiatePaidEnrollment(
    userUuid: string,
    courseUuid: string,
    dto: EnrollDto,
    ipAddress: string,
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }> {
    const course = await this.prisma.course.findUnique({
      where: { uuid: courseUuid },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (!course.isPublished)
      throw new BadRequestException('Course is not published');
    if (course.isFree)
      throw new BadRequestException(
        'This is a free course. Use the free enrollment endpoint.',
      );
    if (!course.price || course.price <= 0)
      throw new BadRequestException('Course price is not configured');

    const existing = await this.prisma.courseEnrollment.findUnique({
      where: { userUuid_courseUuid: { userUuid, courseUuid } },
    });
    if (existing)
      throw new ConflictException('Already enrolled in this course');

    const amount = Number(course.price);
    const currency = 'INR';

    // Resolve coupon + create payment record inside a transaction (race condition protection)
    let paymentRecordUuid: string;
    let orderReceiptId: string;
    let finalAmount = amount;
    let discountAmount = 0;

    await this.prisma.$transaction(async (tx) => {
      let couponUuid: string | undefined;

      if (dto.couponCode) {
        const couponResult = await this.couponService.validateCouponInTx(
          dto.couponCode,
          userUuid,
          PaymentType.LMS_COURSE,
          amount,
          tx,
        );
        discountAmount = couponResult.discountAmount;
        finalAmount = couponResult.finalAmount;
        couponUuid = couponResult.coupon.uuid;
      }

      const receiptId = `lms_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
      orderReceiptId = receiptId;

      const record = await tx.payment.create({
        data: {
          userUuid,
          gatewayOrderId: `pending_${Date.now()}_${receiptId}`,
          amount,
          discountAmount,
          finalAmount,
          currency,
          status: PaymentStatus.PENDING,
          paymentType: PaymentType.LMS_COURSE,
          couponUuid: couponUuid ?? null,
          metadata: { courseUuid },
          termsAcceptedAt: new Date(),
          termsVersion: dto.termsVersion,
          termsAcceptedIp: ipAddress,
        },
      });
      paymentRecordUuid = record.uuid;
    });

    // Create Razorpay order outside the transaction (gateway call must not hold DB tx open)
    let order: { orderId: string };
    try {
      order = await this.paymentProvider.createOrder(
        finalAmount,
        currency,
        orderReceiptId!,
      );
    } catch (err) {
      this.logger.error(
        'LMS enrollment order creation failed:',
        err instanceof Error ? err.stack : JSON.stringify(err) || String(err),
      );
      throw err;
    }

    // Update with real gatewayOrderId
    await this.prisma.payment.update({
      where: { uuid: paymentRecordUuid! },
      data: { gatewayOrderId: order.orderId },
    });

    const keyId = this.configService.get<string>(
      'RAZORPAY_KEY_ID',
      'rzp_test_mock',
    );

    this.logger.log(
      `LMS payment order created: user=${userUuid} course=${courseUuid} orderId=${order.orderId}`,
    );

    // Mock mode: auto-trigger enrollment after 2 seconds
    const paymentProviderName = this.configService.get<string>(
      'PAYMENT_PROVIDER',
      'mock',
    );
    if (paymentProviderName === 'mock') {
      const pUuid = paymentRecordUuid!;
      setTimeout(() => {
        this.processMockLmsPayment(pUuid, courseUuid, userUuid).catch(
          (err: Error) => {
            this.logger.error(
              `Mock LMS payment auto-trigger failed: ${err.message}`,
            );
          },
        );
      }, 2000);
    }

    return { orderId: order.orderId, amount: finalAmount, currency, keyId };
  }

  /**
   * Check if a user is enrolled in a course.
   */
  async getEnrollment(userUuid: string, courseUuid: string) {
    return this.prisma.courseEnrollment.findUnique({
      where: { userUuid_courseUuid: { userUuid, courseUuid } },
    });
  }

  /**
   * Smart enroll — routes to free or paid flow based on course type.
   */
   async enroll(
    userUuid: string,
    courseUuid: string,
    dto?: EnrollDto,
    ipAddress?: string,
  ): Promise<
    | { enrolled: boolean; message: string }
    | { orderId: string; amount: number; currency: string; keyId: string }
  > {
    const course = await this.prisma.course.findUnique({
      where: { uuid: courseUuid },
      select: { isFree: true, isPublished: true, uuid: true },
    });
    if (!course) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Course not found');
    }
     if (course.isFree) {
      return this.enrollFree(userUuid, courseUuid);
    }

    if (!dto || !ipAddress) {
      throw new BadRequestException('Consent data and IP address are required for paid courses');
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

    return this.initiatePaidEnrollment(userUuid, courseUuid, dto, ipAddress);
  }

  // ─── MOCK ONLY ──────────────────────────────────────────

  private async processMockLmsPayment(
    paymentUuid: string,
    courseUuid: string,
    userUuid: string,
  ): Promise<void> {
    const mockPaymentId = `mock_lms_pay_${Date.now()}`;
    this.logger.log(
      `[MOCK] Auto-enrolling user=${userUuid} in course=${courseUuid}`,
    );

    // Look up couponUuid before marking as success
    const paymentForCoupon = await this.prisma.payment.findUnique({
      where: { uuid: paymentUuid },
      select: { couponUuid: true },
    });

    await this.prisma.payment.update({
      where: { uuid: paymentUuid },
      data: { gatewayPaymentId: mockPaymentId, status: PaymentStatus.SUCCESS },
    });

    // Increment coupon usedCount on successful mock payment
    if (paymentForCoupon?.couponUuid) {
      try {
        await this.prisma.couponUse.create({
          data: { couponUuid: paymentForCoupon.couponUuid, userUuid },
        });
        await this.prisma.coupon.update({
          where: { uuid: paymentForCoupon.couponUuid },
          data: { usedCount: { increment: 1 } },
        });
      } catch {
        // @@unique constraint — already incremented (idempotent)
      }
    }

    const existing = await this.prisma.courseEnrollment.findUnique({
      where: { userUuid_courseUuid: { userUuid, courseUuid } },
    });
    if (!existing) {
      await this.prisma.courseEnrollment.create({
        data: { userUuid, courseUuid },
      });
      this.logger.log(
        `[MOCK] Enrollment created: user=${userUuid} course=${courseUuid}`,
      );
    }
  }
}
