import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service.js';
import { OtpService } from '../otp/otp.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { LeadsService } from '../leads/leads.service.js';
import { isValidCountryCode } from '../common/constants/countries.js';
import { UserStatus, AuthProvider } from '@prisma/client';
import type { Request } from 'express';

const BCRYPT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  needsCountry: boolean;
  user: {
    uuid: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
    avatarUrl: string | null;
  };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenExpiryMs: number;

  /**
   * Short-lived in-memory store for Google OAuth session codes.
   * Code → { accessToken, refreshToken, needsCountry } with 60-second TTL.
   * Solves the cross-domain cookie problem: callback (ngrok) stores here,
   * finalize-google endpoint (localhost) reads and sets cookie on the correct domain.
   */
  private readonly oauthSessions = new Map<string, {
    accessToken: string;
    refreshToken: string;
    user: AuthResponse['user'];
    needsCountry: boolean;
    expiresAt: Date;
  }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly trackingService: TrackingService,
    @Inject(forwardRef(() => LeadsService)) private readonly leadsService: LeadsService,
  ) {
    // Parse refresh token expiry from config (default 7d)
    const expiresIn = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d');
    this.refreshTokenExpiryMs = this.parseDuration(expiresIn);
  }

  // ─── CLEANUP EXPIRED SESSIONS ON STARTUP ─────────────
  async onModuleInit(): Promise<void> {
    try {
      const result = await this.prisma.authSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired session(s) on startup`);
      }
    } catch (error) {
      this.logger.error('Failed to clean expired sessions on startup', error);
    }
  }

  // ─── STEP 1: SIGNUP ──────────────────────────────────
  async signup(
    fullName: string,
    email: string,
    password: string,
    ipAddress: string,
    referralCode?: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();

    // Check email not already registered
    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user in DB
    const user = await this.usersService.create({
      fullName,
      email: normalizedEmail,
      passwordHash,
    });

    // If referralCode provided: validate and pre-populate UserAcquisition with distributor info
    // (fire-and-forget — never block signup)
    if (referralCode) {
      void this.attachReferralCode(user.uuid, referralCode);
    }

    // Generate and store OTP
    const otp = this.otpService.generateOtp();
    await this.otpService.storeOtp(normalizedEmail, otp);

    // Send OTP email — fire and forget, NEVER blocks response
    this.mailService.sendOTP(normalizedEmail, fullName, otp);

    // Audit log
    this.auditService.log({
      actorUuid: user.uuid,
      action: 'USER_SIGNUP',
      metadata: { email: normalizedEmail },
      ipAddress,
    });

    return { message: 'Registration successful. Check your email for OTP.' };
  }

  /**
   * Validate a referral code and pre-populate UserAcquisition so the lead is attributed.
   * Called fire-and-forget from signup — never throws.
   */
  private async attachReferralCode(userUuid: string, referralCode: string): Promise<void> {
    try {
      const distributor = await this.prisma.user.findFirst({
        where: { distributorCode: referralCode, joinLinkActive: true },
      });
      if (!distributor) return; // invalid or inactive — silently ignore

      // Upsert UserAcquisition with distributor info so createLeadForUser picks it up
      await this.prisma.userAcquisition.upsert({
        where: { userUuid },
        create: {
          userUuid,
          distributorCode: referralCode,
          distributorUuid: distributor.uuid,
        },
        update: {
          distributorCode: referralCode,
          distributorUuid: distributor.uuid,
        },
      });
    } catch (error) {
      this.logger.error(`attachReferralCode failed for user ${userUuid}: ${(error as Error).message}`);
    }
  }

  // ─── STEP 2: VERIFY EMAIL OTP + AUTO LOGIN ───────────
  async verifyEmailOtp(
    email: string,
    otp: string,
    ipAddress: string,
    userAgent: string,
    request: Request,
  ): Promise<AuthResponse> {
    const normalizedEmail = email.toLowerCase();

    // Find user from DB — single source of truth
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestException('Invalid email or OTP');
    }

    // Check if OTP is blocked (max attempts reached)
    const isBlocked = await this.otpService.isOtpBlocked(normalizedEmail);
    if (isBlocked) {
      throw new BadRequestException(
        'Maximum OTP attempts reached. Please request a new OTP.',
      );
    }

    // Verify OTP against stored hash
    const result = await this.otpService.verifyOtp(normalizedEmail, otp);

    if (!result.valid) {
      if (result.attemptsRemaining === 0) {
        throw new BadRequestException(
          'Maximum OTP attempts reached. Please request a new OTP.',
        );
      }
      throw new BadRequestException(
        `Invalid OTP. ${result.attemptsRemaining} attempt(s) remaining.`,
      );
    }

    // OTP verified — update user in DB
    await this.usersService.updateEmailVerified(user.uuid);

    // Attach UTM acquisition data from cookie — fire and forget
    // This is the earliest moment we know who the user is (email confirmed)
    void this.trackingService.attachToUser(user.uuid, request);

    // Re-fetch user from DB after update — single source of truth
    const updatedUser = await this.usersService.findByUuid(user.uuid);
    if (!updatedUser) {
      throw new BadRequestException('User not found');
    }

    // Check if country is null → set status to PROFILE_INCOMPLETE
    let finalUser = updatedUser;
    if (!updatedUser.country) {
      finalUser = await this.usersService.updateStatus(
        updatedUser.uuid,
        UserStatus.PROFILE_INCOMPLETE,
      );
    }

    // AUTO LOGIN — generate tokens
    const tokens = await this.generateTokenPair(finalUser.uuid, finalUser.email, finalUser.role, finalUser.status);

    // Store refresh token session
    await this.createSession(
      finalUser.uuid,
      tokens.refreshToken,
      ipAddress,
      userAgent,
    );

    // Audit log
    this.auditService.log({
      actorUuid: finalUser.uuid,
      action: 'EMAIL_VERIFIED',
      metadata: { email: normalizedEmail },
      ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      needsCountry: !finalUser.country,
      user: {
        uuid: finalUser.uuid,
        fullName: finalUser.fullName,
        email: finalUser.email,
        role: finalUser.role,
        status: finalUser.status,
        avatarUrl: finalUser.avatarUrl ?? null,
      },
    };
  }

  // ─── STEP 3: COMPLETE PROFILE ────────────────────────
  async completeProfile(
    userUuid: string,
    country: string,
    ipAddress: string,
  ): Promise<{ message: string }> {
    // Validate country against ISO list
    if (!isValidCountryCode(country)) {
      throw new BadRequestException('Invalid country code');
    }

    // Fetch fresh user from DB — single source of truth
    const user = await this.usersService.findByUuid(userUuid);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Only allow profile completion if status warrants it
    if (user.status !== UserStatus.PROFILE_INCOMPLETE && user.status !== UserStatus.EMAIL_VERIFIED) {
      throw new BadRequestException('Profile completion is not required');
    }

    // Update user with country and set status to ACTIVE
    await this.usersService.updateCountry(userUuid, country.toUpperCase());

    // Create lead for this user — fire and forget
    void this.leadsService.createLeadForUser(userUuid);

    // Audit log
    this.auditService.log({
      actorUuid: userUuid,
      action: 'PROFILE_COMPLETED',
      metadata: { country: country.toUpperCase() },
      ipAddress,
    });

    // Send welcome email — fire and forget
    this.mailService.sendWelcome(user.email, user.fullName);

    return { message: 'Profile completed successfully.' };
  }

  // ─── STEP 4: LOGIN ───────────────────────────────────
  async login(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthResponse> {
    const normalizedEmail = email.toLowerCase();

    // Find user from DB — single source of truth
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Enforce status rules strictly — always from DB, never from frontend
    if (user.status === UserStatus.REGISTERED) {
      throw new UnauthorizedException('Please verify your email first');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended');
    }

    // Compare password against hash
    if (user.authProvider === AuthProvider.GOOGLE && !user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google Sign-In. Please continue with Google.',
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user.uuid, user.email, user.role, user.status);

    // Store refresh token session
    await this.createSession(user.uuid, tokens.refreshToken, ipAddress, userAgent);

    // Audit log
    this.auditService.log({
      actorUuid: user.uuid,
      action: 'USER_LOGIN',
      metadata: { email: normalizedEmail },
      ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      needsCountry: !user.country,
      user: {
        uuid: user.uuid,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }

  // ─── STEP 5: RESEND OTP ──────────────────────────────
  async resendOtp(
    email: string,
    ipAddress: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();

    // Check resend rate limit FIRST — always enforce, regardless of user status
    const canResend = await this.otpService.checkResendLimit(normalizedEmail);

    if (!canResend) {
      throw new BadRequestException('Too many requests. Please wait 1 hour before requesting again.');
    }

    // Find user from DB — single source of truth
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      // Return generic message to prevent email enumeration
      return { message: 'If your email is registered, a new OTP has been sent.' };
    }

    // Only allow resend if user is still REGISTERED (from DB, not from request)
    if (user.status !== UserStatus.REGISTERED) {
      return { message: 'If your email is registered, a new OTP has been sent.' };
    }

    // Delete old OTP and generate new one
    await this.otpService.deleteOtp(normalizedEmail);
    const otp = this.otpService.generateOtp();
    await this.otpService.storeOtp(normalizedEmail, otp);

    // Send new OTP — fire and forget
    this.mailService.sendOTP(normalizedEmail, user.fullName, otp);

    // Audit log
    this.auditService.log({
      actorUuid: user.uuid,
      action: 'OTP_RESENT',
      metadata: { email: normalizedEmail },
      ipAddress,
    });

    return { message: 'New OTP sent. Check your email.' };
  }

  // ─── STEP 6: TOKEN REFRESH ───────────────────────────
  async refreshToken(
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthResponse> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    // Extract tokenId (first 16 chars) for O(1) lookup — no full table scan
    const tokenId = refreshToken.substring(0, 16);

    // Find single session by tokenId + not expired
    const session = await this.prisma.authSession.findFirst({
      where: {
        tokenId,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Verify the full token hash — only ONE bcrypt.compare, not a loop
    const isMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Fetch fresh user from DB — single source of truth
    const user = await this.usersService.findByUuid(session.userUuid);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === UserStatus.SUSPENDED) {
      // Delete all sessions for suspended user
      await this.prisma.authSession.deleteMany({
        where: { userUuid: user.uuid },
      });
      throw new ForbiddenException('Your account has been suspended');
    }

    // Rotate refresh token — delete old, create new
    await this.prisma.authSession.delete({
      where: { uuid: session.uuid },
    });

    // Generate new token pair
    const tokens = await this.generateTokenPair(user.uuid, user.email, user.role, user.status);

    // Store new session
    await this.createSession(user.uuid, tokens.refreshToken, ipAddress, userAgent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      needsCountry: !user.country,
      user: {
        uuid: user.uuid,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }

  // ─── SET PASSWORD (FOR GOOGLE USERS) ───────────
  async setPassword(
    userUuid: string,
    newPassword: string,
    ipAddress: string,
  ): Promise<{ message: string }> {
    // Fetch fresh user from DB
    const user = await this.usersService.findByUuid(userUuid);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Security check: If user already has a password, they should use change-password
    if (user.passwordHash) {
      throw new BadRequestException(
        'You already have a password. Use the password reset flow instead.',
      );
    }

    // Hash new password with bcrypt 12
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update user in DB
    await this.usersService.updatePassword(user.uuid, passwordHash);

    // Audit log
    this.auditService.log({
      actorUuid: user.uuid,
      action: 'PASSWORD_SET_FOR_GOOGLE_USER',
      metadata: { email: user.email },
      ipAddress,
    });

    return {
      message:
        'Password set successfully. You can now login with email and password.',
    };
  }

  // ─── STEP 8: FORGOT PASSWORD ─────────────────────────
  async forgotPassword(
    email: string,
    ipAddress: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();

    // Check resend rate limit FIRST — always enforce
    const canResend = await this.otpService.checkResendLimit(normalizedEmail);

    if (!canResend) {
      throw new BadRequestException('Too many requests. Please wait 1 hour before requesting again.');
    }

    // Find user from DB
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      // Return generic message to prevent email enumeration
      return { message: 'If your email is registered, a password reset OTP has been sent.' };
    }

    // Block unverified users — they must verify email first, not reset password
    if (user.status === UserStatus.REGISTERED) {
      return { message: 'If your email is registered, a password reset OTP has been sent.' };
    }

    // Delete old OTP and generate new one
    await this.otpService.deleteOtp(normalizedEmail);
    const otp = this.otpService.generateOtp();
    await this.otpService.storeOtp(normalizedEmail, otp);

    // Send password reset OTP — fire and forget
    this.mailService.sendPasswordResetOTP(normalizedEmail, user.fullName, otp);

    // Audit log
    this.auditService.log({
      actorUuid: user.uuid,
      action: 'PASSWORD_RESET_REQUESTED',
      metadata: { email: normalizedEmail },
      ipAddress,
    });

    return { message: 'If your email is registered, a password reset OTP has been sent.' };
  }

  // ─── STEP 9: RESET PASSWORD ──────────────────────────
  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
    ipAddress: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();

    // Find user from DB
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestException('Invalid email or OTP');
    }

    // Check if OTP is blocked
    const isBlocked = await this.otpService.isOtpBlocked(normalizedEmail);
    if (isBlocked) {
      throw new BadRequestException(
        'Maximum OTP attempts reached. Please request a new OTP.',
      );
    }

    // Verify OTP against stored hash
    const result = await this.otpService.verifyOtp(normalizedEmail, otp);

    if (!result.valid) {
      if (result.attemptsRemaining === 0) {
        throw new BadRequestException(
          'Maximum OTP attempts reached. Please request a new OTP.',
        );
      }
      throw new BadRequestException(
        `Invalid OTP. ${result.attemptsRemaining} attempt(s) remaining.`,
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update user password
    await this.usersService.updatePassword(user.uuid, passwordHash);

    // Delete all existing sessions so old logins are invalidated
    await this.prisma.authSession.deleteMany({
      where: { userUuid: user.uuid },
    });

    // Audit log
    this.auditService.log({
      actorUuid: user.uuid,
      action: 'PASSWORD_RESET_COMPLETED',
      metadata: { email: normalizedEmail },
      ipAddress,
    });

    return { message: 'Password has been safely reset. Please log in with your new password.' };
  }

  // ─── GOOGLE LOGIN ───────────────────────────────────
  async handleGoogleLogin(
    googleId: string,
    email: string,
    fullName: string,
    ipAddress: string,
    userAgent: string,
    avatarUrl?: string | null,
  ): Promise<AuthResponse> {
    // CASE 1 — Returning Google user (find by googleId)
    const existingGoogleUser = await this.usersService.findByGoogleId(googleId);
    if (existingGoogleUser) {
      if (avatarUrl && existingGoogleUser.avatarUrl !== avatarUrl) {
        await this.usersService.updateAvatarUrl(existingGoogleUser.uuid, avatarUrl);
        existingGoogleUser.avatarUrl = avatarUrl;
      }
      // Issue tokens
      const tokens = await this.generateTokenPair(
        existingGoogleUser.uuid,
        existingGoogleUser.email,
        existingGoogleUser.role,
        existingGoogleUser.status,
      );
      await this.createSession(
        existingGoogleUser.uuid,
        tokens.refreshToken,
        ipAddress,
        userAgent,
      );
      this.auditService.log({
        actorUuid: existingGoogleUser.uuid,
        action: 'GOOGLE_LOGIN_RETURNING',
        metadata: { email },
        ipAddress,
      });
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        needsCountry: !existingGoogleUser.country,
        user: {
          uuid: existingGoogleUser.uuid,
          fullName: existingGoogleUser.fullName,
          email: existingGoogleUser.email,
          role: existingGoogleUser.role,
          status: existingGoogleUser.status,
          avatarUrl: existingGoogleUser.avatarUrl ?? null,
        },
      };
    }

    // CASE 2 — Existing email user (AUTO MERGE)
    const normalizedEmail = email.toLowerCase();
    const existingEmailUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingEmailUser) {
      // Merge: add googleId to existing account
      const mergedUser = await this.usersService.mergeGoogleAccount(
        existingEmailUser.uuid,
        googleId,
        avatarUrl,
      );
      const tokens = await this.generateTokenPair(
        mergedUser.uuid,
        mergedUser.email,
        mergedUser.role,
        mergedUser.status,
      );
      await this.createSession(
        mergedUser.uuid,
        tokens.refreshToken,
        ipAddress,
        userAgent,
      );
      this.auditService.log({
        actorUuid: mergedUser.uuid,
        action: 'GOOGLE_LOGIN_MERGE',
        metadata: { email },
        ipAddress,
      });
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        needsCountry: !mergedUser.country,
        user: {
          uuid: mergedUser.uuid,
          fullName: mergedUser.fullName,
          email: mergedUser.email,
          role: mergedUser.role,
          status: mergedUser.status,
          avatarUrl: mergedUser.avatarUrl ?? null,
        },
      };
    }

    // CASE 3 — Brand new user via Google
    const newUser = await this.usersService.createGoogleUser({
      fullName,
      email: email.toLowerCase(),
      googleId,
      avatarUrl,
    });

    // Check country — set PROFILE_INCOMPLETE if missing
    let finalUser = newUser;
    if (!newUser.country) {
      finalUser = await this.usersService.updateStatus(
        newUser.uuid,
        UserStatus.PROFILE_INCOMPLETE,
      );
    }

    const tokens = await this.generateTokenPair(
      finalUser.uuid,
      finalUser.email,
      finalUser.role,
      finalUser.status,
    );
    await this.createSession(
      finalUser.uuid,
      tokens.refreshToken,
      ipAddress,
      userAgent,
    );
    this.auditService.log({
      actorUuid: finalUser.uuid,
      action: 'GOOGLE_LOGIN_NEW',
      metadata: { email },
      ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      needsCountry: !finalUser.country,
      user: {
        uuid: finalUser.uuid,
        fullName: finalUser.fullName,
        email: finalUser.email,
        role: finalUser.role,
        status: finalUser.status,
        avatarUrl: finalUser.avatarUrl ?? null,
      },
    };
  }

  // ─── STEP 7: LOGOUT ──────────────────────────────────
  async logout(
    refreshToken: string | undefined,
    userUuid: string | undefined,
    ipAddress: string,
  ): Promise<{ message: string }> {
    if (refreshToken) {
      // O(1) lookup using tokenId — no full table scan
      const tokenId = refreshToken.substring(0, 16);
      const session = await this.prisma.authSession.findFirst({
        where: { tokenId },
      });

      if (session) {
        const isMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (isMatch) {
          await this.prisma.authSession.delete({
            where: { uuid: session.uuid },
          });
        }
      }
    }

    // Audit log
    if (userUuid) {
      this.auditService.log({
        actorUuid: userUuid,
        action: 'USER_LOGOUT',
        metadata: {},
        ipAddress,
      });
    }

    return { message: 'Logged out successfully.' };
  }

  // ─── GOOGLE OAUTH SESSION HELPERS ─────────────────

  /**
   * Store a short-lived OAuth session code.
   * Returns a UUID that can be safely passed in a redirect URL.
   * The code expires in 60 seconds and is deleted on first use.
   */
  storeOAuthCode(data: {
    accessToken: string;
    refreshToken: string;
    user: AuthResponse['user'];
    needsCountry: boolean;
  }): string {
    const code = uuidv4();
    const expiresAt = new Date(Date.now() + 60_000); // 60 seconds
    this.oauthSessions.set(code, { ...data, expiresAt });

    // Auto-purge expired entries (fire-and-forget housekeeping)
    setTimeout(() => this.oauthSessions.delete(code), 60_000);

    return code;
  }

  /**
   * Redeem a Google OAuth session code (one-time use, 60s TTL).
   * Returns null if the code is invalid or expired.
   */
  redeemOAuthCode(code: string): {
    accessToken: string;
    refreshToken: string;
    user: AuthResponse['user'];
    needsCountry: boolean;
  } | null {
    const session = this.oauthSessions.get(code);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      this.oauthSessions.delete(code);
      return null;
    }
    this.oauthSessions.delete(code); // one-time use
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
      needsCountry: session.needsCountry,
    };
  }

  // ─── GET ME (CURRENT USER PROFILE) ──────────────────
  async getMe(userUuid: string) {
    const user = await this.usersService.findByUuid(userUuid);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      uuid: user.uuid,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl ?? null,
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────


  private async generateTokenPair(
    uuid: string,
    email: string,
    role: string,
    status: string,
  ): Promise<TokenPair> {
    const payload = { sub: uuid, email, role, status };

    const expiresInStr = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    const expiresInSeconds = this.parseDurationToSeconds(expiresInStr);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: expiresInSeconds,
    });

    const refreshToken = uuidv4();

    return { accessToken, refreshToken };
  }

  private async createSession(
    userUuid: string,
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiryMs);

    // Store first 16 chars of UUID as non-sensitive lookup token
    // This allows O(1) session lookup without scanning all sessions
    const tokenId = refreshToken.substring(0, 16);

    await this.prisma.authSession.create({
      data: {
        userUuid,
        tokenId,
        refreshTokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // default 7 days
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default:  return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // default 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default:  return 900;
    }
  }
}
