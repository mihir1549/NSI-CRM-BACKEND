import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LeadsService } from '../leads/leads.service.js';
import { PHONE_PROVIDER_TOKEN } from './providers/phone-provider.interface.js';
import type { PhoneProvider } from './providers/phone-provider.interface.js';

const SEND_LIMIT_MAX = 3;
const SEND_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ATTEMPT_LIMIT_MAX = 3;
const PHONE_OTP_MARKER = 'PHONE_VERIFICATION';

@Injectable()
export class PhoneService {
  private readonly logger = new Logger(PhoneService.name);

  /**
   * In-memory wrong attempt tracker: phone → attempts
   * Max 3 wrong attempts before lockout (per hour window matches send tracker reset).
   */
  private readonly attemptTracker = new Map<
    string,
    { count: number; windowStart: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leadsService: LeadsService,
    @Inject(PHONE_PROVIDER_TOKEN) private readonly phoneProvider: PhoneProvider,
  ) {}

  // ─── SEND OTP ───────────────────────────────────────────

  async sendOtp(
    userUuid: string,
    rawPhone: string,
    channel: 'whatsapp' | 'sms',
    ipAddress: string,
  ): Promise<{ message: string; channel: string }> {
    const phone = this.normalizePhone(rawPhone);

    // 1. Rate limit: max 3 OTP sends per user per hour — tracked in DB (email_otps table)
    const windowStart = new Date(Date.now() - SEND_LIMIT_WINDOW_MS);
    const sendCount = await this.prisma.emailOTP.count({
      where: {
        userUuid,
        otpHash: PHONE_OTP_MARKER,
        createdAt: { gt: windowStart },
      },
    });
    if (sendCount >= SEND_LIMIT_MAX) {
      throw new HttpException(
        'Too many OTP requests. Please wait 1 hour before requesting again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Record this send in DB before further checks so failed attempts count toward the limit
    await this.prisma.emailOTP.create({
      data: {
        userUuid,
        otpHash: PHONE_OTP_MARKER,
        expiresAt: new Date(Date.now() + SEND_LIMIT_WINDOW_MS),
        attempts: 0,
        used: false,
      },
    });

    // 2. Check if phone is already registered to another user
    const existingProfile = await this.prisma.userProfile.findUnique({
      where: { phone },
    });
    if (existingProfile && existingProfile.userUuid !== userUuid) {
      this.audit.log({
        actorUuid: userUuid,
        action: 'PHONE_ALREADY_REGISTERED_ATTEMPT',
        metadata: { phone, existingUserUuid: existingProfile.userUuid },
        ipAddress,
      });
      this.logger.warn(
        `[FRAUD ATTEMPT] Phone already registered: user=${userUuid} phone=${phone}`,
      );
      throw new ConflictException(
        'Phone number already registered to another account',
      );
    }

    // 3. Check if requesting user already has phoneVerified in funnel_progress
    const progress = await this.prisma.funnelProgress.findUnique({
      where: { userUuid },
    });
    if (progress?.phoneVerified) {
      throw new ConflictException('Phone already verified for this account');
    }

    // 4. Send OTP via provider
    await this.phoneProvider.sendOtp(phone, channel);

    this.logger.log(`OTP sent to ${phone} via ${channel} for user ${userUuid}`);

    return { message: 'OTP sent successfully', channel };
  }

  // ─── VERIFY OTP ─────────────────────────────────────────

  async verifyOtp(
    userUuid: string,
    rawPhone: string,
    code: string,
    channel: 'whatsapp' | 'sms',
    ipAddress: string,
  ): Promise<{
    message: string;
    progress: {
      phoneVerified: boolean;
      paymentCompleted: boolean;
      currentStepUuid: string | null;
      currentSectionUuid: string | null;
    };
  }> {
    const phone = this.normalizePhone(rawPhone);

    // 1. Check attempt count: max 3 wrong attempts before lockout
    const now = Date.now();
    const attemptEntry = this.attemptTracker.get(phone);
    if (attemptEntry && now - attemptEntry.windowStart < SEND_LIMIT_WINDOW_MS) {
      if (attemptEntry.count >= ATTEMPT_LIMIT_MAX) {
        throw new HttpException(
          'Too many wrong attempts. Try again in 1 hour.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 2. Verify OTP with provider
    const isValid = await this.phoneProvider.verifyOtp(phone, code, channel);

    if (!isValid) {
      // Increment attempt counter
      if (
        attemptEntry &&
        now - attemptEntry.windowStart < SEND_LIMIT_WINDOW_MS
      ) {
        attemptEntry.count += 1;
      } else {
        this.attemptTracker.set(phone, { count: 1, windowStart: now });
      }
      throw new BadRequestException('Invalid OTP');
    }

    // Reset attempt counter on success
    this.attemptTracker.delete(phone);

    // 3. Create or update user_profiles record
    await this.prisma.userProfile.upsert({
      where: { userUuid },
      create: {
        userUuid,
        phone,
        phoneVerifiedAt: new Date(),
      },
      update: {
        phone,
        phoneVerifiedAt: new Date(),
      },
    });

    // 4. Get or create funnel progress, advance step
    let funnelProgress = await this.prisma.funnelProgress.findUnique({
      where: { userUuid },
    });

    if (!funnelProgress) {
      funnelProgress = await this.prisma.funnelProgress.create({
        data: { userUuid, phoneVerified: true },
      });
    } else {
      // Find next step before updating
      const nextStep = funnelProgress.currentStepUuid
        ? await this.findNextStepFromCurrent(funnelProgress.currentStepUuid)
        : null;

      // Mark step as completed and advance
      if (funnelProgress.currentStepUuid) {
        await this.prisma.stepProgress.upsert({
          where: {
            funnelProgressUuid_stepUuid: {
              funnelProgressUuid: funnelProgress.uuid,
              stepUuid: funnelProgress.currentStepUuid,
            },
          },
          create: {
            funnelProgressUuid: funnelProgress.uuid,
            stepUuid: funnelProgress.currentStepUuid,
            isCompleted: true,
            completedAt: new Date(),
          },
          update: {
            isCompleted: true,
            completedAt: new Date(),
          },
        });
      }

      const updateData: Record<string, unknown> = {
        phoneVerified: true,
        lastSeenAt: new Date(),
      };
      if (nextStep) {
        updateData.currentStepUuid = nextStep.uuid;
        updateData.currentSectionUuid = nextStep.sectionUuid;
      } else {
        updateData.currentStepUuid = null;
      }

      funnelProgress = await this.prisma.funnelProgress.update({
        where: { uuid: funnelProgress.uuid },
        data: updateData,
      });
    }

    // Audit log
    this.audit.log({
      actorUuid: userUuid,
      action: 'PHONE_VERIFIED',
      metadata: { phone },
      ipAddress,
    });

    // Update lead status to WARM — fire and forget
    void this.leadsService.onPhoneVerified(userUuid);

    return {
      message: 'Phone verified successfully',
      progress: {
        phoneVerified: funnelProgress.phoneVerified,
        paymentCompleted: funnelProgress.paymentCompleted,
        currentStepUuid: funnelProgress.currentStepUuid,
        currentSectionUuid: funnelProgress.currentSectionUuid,
      },
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────

  normalizePhone(phone: string): string {
    // Remove all spaces, dashes, brackets, dots
    let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
    // If starts with 0, replace with +91 (India default)
    if (normalized.startsWith('0')) {
      normalized = '+91' + normalized.slice(1);
    }
    // If starts with 91 without +, add +
    if (normalized.startsWith('91') && !normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    // Validate E.164 format
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      throw new BadRequestException(
        'Invalid phone number format. Use E.164 format: +91XXXXXXXXXX',
      );
    }
    return normalized;
  }

  private async findNextStepFromCurrent(currentStepUuid: string) {
    const currentStep = await this.prisma.funnelStep.findUnique({
      where: { uuid: currentStepUuid },
    });
    if (!currentStep) return null;

    // Try next step in same section
    const nextInSection = await this.prisma.funnelStep.findFirst({
      where: {
        sectionUuid: currentStep.sectionUuid,
        isActive: true,
        order: { gt: currentStep.order },
      },
      orderBy: { order: 'asc' },
    });
    if (nextInSection) return nextInSection;

    // Try first step in next section
    const currentSection = await this.prisma.funnelSection.findUnique({
      where: { uuid: currentStep.sectionUuid },
    });
    if (!currentSection) return null;

    const nextSection = await this.prisma.funnelSection.findFirst({
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
