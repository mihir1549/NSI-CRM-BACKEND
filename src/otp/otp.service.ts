import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;
const RESEND_LIMIT_MAX = 3;
const RESEND_LIMIT_WINDOW_SECONDS = 3600; // 1 hour

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a cryptographically random 6-digit numeric OTP.
   */
  generateOtp(): string {
    const buffer = crypto.randomBytes(4);
    const num = buffer.readUInt32BE(0) % 1000000;
    return num.toString().padStart(6, '0');
  }

  /**
   * Hash and store an OTP in the email_otps table.
   * Deletes any existing unused OTPs for this email first.
   */
  async storeOtp(email: string, otp: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    // Find the user by email to get their UUID
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      this.logger.warn(`storeOtp called for non-existent email: ${normalizedEmail}`);
      return;
    }

    // Delete existing unused OTPs for this user
    await this.prisma.emailOTP.updateMany({
      where: { userUuid: user.uuid, used: false },
      data: { used: true },
    });

    // Hash the OTP and insert new record
    const otpHash = await bcrypt.hash(otp, 12);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await this.prisma.emailOTP.create({
      data: {
        userUuid: user.uuid,
        otpHash,
        attempts: 0,
        expiresAt,
      },
    });
  }

  /**
   * Verify an OTP against the stored hash in PostgreSQL.
   * Returns: { valid: true } or { valid: false, attemptsRemaining }
   */
  async verifyOtp(
    email: string,
    otp: string,
  ): Promise<{ valid: boolean; attemptsRemaining?: number }> {
    const normalizedEmail = email.toLowerCase();

    // Find the user by email
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { valid: false, attemptsRemaining: 0 };
    }

    // Find the latest unused, non-expired OTP for this user
    const otpRecord = await this.prisma.emailOTP.findFirst({
      where: {
        userUuid: user.uuid,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return { valid: false, attemptsRemaining: 0 };
    }

    // Check if max attempts reached
    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      return { valid: false, attemptsRemaining: 0 };
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);

    if (!isMatch) {
      // Increment attempts in the database
      await this.prisma.emailOTP.update({
        where: { uuid: otpRecord.uuid },
        data: { attempts: otpRecord.attempts + 1 },
      });

      const remaining = OTP_MAX_ATTEMPTS - (otpRecord.attempts + 1);
      return { valid: false, attemptsRemaining: remaining };
    }

    // OTP is valid — mark as used
    await this.prisma.emailOTP.update({
      where: { uuid: otpRecord.uuid },
      data: { used: true },
    });

    return { valid: true };
  }

  /**
   * Delete (mark as used) any existing unused OTPs for the given email.
   */
  async deleteOtp(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) return;

    await this.prisma.emailOTP.updateMany({
      where: { userUuid: user.uuid, used: false },
      data: { used: true },
    });
  }

  /**
   * In-memory rate limit tracker for resend-otp endpoint.
   * Maps email → { count, windowStart }
   * Resets on server restart (acceptable for this use case).
   */
  private resendTracker = new Map<string, { count: number; windowStart: number }>();

  /**
   * Check and increment the resend rate limit.
   * Returns true if resend is allowed, false if limit reached.
   * Uses in-memory tracking so it works even when no OTP is created.
   */
  async checkResendLimit(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();
    const now = Date.now();
    const windowMs = RESEND_LIMIT_WINDOW_SECONDS * 1000;

    const entry = this.resendTracker.get(normalizedEmail);

    if (!entry || (now - entry.windowStart) > windowMs) {
      // First attempt or window expired — start fresh
      this.resendTracker.set(normalizedEmail, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= RESEND_LIMIT_MAX) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  /**
   * Check if OTP exists and if max attempts have been reached.
   */
  async isOtpBlocked(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) return false;

    const otpRecord = await this.prisma.emailOTP.findFirst({
      where: {
        userUuid: user.uuid,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) return false;

    return otpRecord.attempts >= OTP_MAX_ATTEMPTS;
  }
}
