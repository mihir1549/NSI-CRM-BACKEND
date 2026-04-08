import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResendOtpDto } from './dto/resend-otp.dto.js';
import { CompleteProfileDto } from './dto/complete-profile.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── STEP 1: SIGNUP ──────────────────────────────────
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 per 15 min
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.signup(dto.fullName, dto.email, dto.password, ipAddress, dto.referralCode);
  }

  // ─── STEP 2: VERIFY EMAIL OTP + AUTO LOGIN ───────────
  @Post('verify-email-otp')
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 per 15 min
  @HttpCode(HttpStatus.OK)
  async verifyEmailOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const result = await this.authService.verifyEmailOtp(
      dto.email,
      dto.otp,
      ipAddress,
      userAgent,
      req,
    );

    // Set refresh token as HttpOnly cookie — frontend NEVER reads this
    this.setRefreshTokenCookie(req, res, result.refreshToken);

    // The refresh token is embedded in the session, not returned in body
    return {
      accessToken: result.accessToken,
      user: result.user,
      needsCountry: result.needsCountry,
    };
  }

  // ─── STEP 3: COMPLETE PROFILE ────────────────────────
  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeProfile(
    @Body() dto: CompleteProfileDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.completeProfile(user.sub, dto.country, ipAddress);
  }

  // ─── STEP 4: LOGIN ───────────────────────────────────
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 per 15 min
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const result = await this.authService.login(
      dto.email,
      dto.password,
      ipAddress,
      userAgent,
    );

    // Set refresh token as HttpOnly cookie
    this.setRefreshTokenCookie(req, res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
      needsCountry: result.needsCountry,
    };
  }

  // ─── STEP 5: RESEND OTP ──────────────────────────────
  @Post('resend-otp')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 per hour
  @HttpCode(HttpStatus.OK)
  async resendOtp(
    @Body() dto: ResendOtpDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.resendOtp(dto.email, ipAddress);
  }

  // ─── STEP 6: TOKEN REFRESH ───────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const result = await this.authService.refreshToken(
      refreshToken,
      ipAddress,
      userAgent,
    );

    // Set new refresh token cookie (rotation)
    this.setRefreshTokenCookie(req, res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
      needsCountry: result.needsCountry,
    };
  }

  // ─── AUTH ME (GET CURRENT USER) ──────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  // ─── STEP 7: LOGOUT ──────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Try to get user UUID from JWT if present (optional — logout should work even without valid JWT)
    let userUuid: string | undefined;
    try {
      const authHeader = req.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Use JwtService.decode — proper NestJS way, does not verify signature
        // (which is fine for logout — the token may be expired)
        const decoded = this.jwtService.decode(token) as { sub?: string } | null;
        userUuid = decoded?.sub;
      }
    } catch {
      // Ignore — logout still proceeds
    }

    const result = await this.authService.logout(refreshToken, userUuid, ipAddress);

    // Clear the HttpOnly cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
    });

    return result;
  }

  // ─── STEP 8: FORGOT PASSWORD ─────────────────────────
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 per hour
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.forgotPassword(dto.email, ipAddress);
  }

  // ─── STEP 9: RESET PASSWORD ──────────────────────────
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 per 15 min
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.resetPassword(dto.email, dto.otp, dto.newPassword, ipAddress);
  }

  // ─── GOOGLE OAuth — Initiate ─────────────────────
  /**
   * Initiates Google OAuth flow.
   * referralCode is forwarded as OAuth `state` so it survives the Google redirect.
   * On callback, passport-google-oauth20 returns state via req.query.state.
   */
  @Get('google')
  async googleAuth(
    @Query('referralCode') referralCode: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const authenticator = passport.authenticate('google', {
      scope: ['email', 'profile'],
      state: referralCode || '',
    });
    authenticator(req, res, () => {});
  }

  // ─── GOOGLE OAuth — Callback ─────────────────────
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const googleUser = req.user as {
      googleId: string;
      email: string;
      fullName: string;
      emailVerified: boolean;
      avatarUrl?: string | null;
      referralCode?: string;
    };

    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const result = await this.authService.handleGoogleLogin(
      googleUser.googleId,
      googleUser.email,
      googleUser.fullName,
      ipAddress,
      userAgent,
      googleUser.avatarUrl,
      googleUser.referralCode,
    );

    /**
     * TWO-HOP REDIRECT — fixes the cross-domain cookie problem.
     *
     * Problem: this callback is hit via ngrok (HTTPS). If we set the
     * refresh_token cookie here and redirect to the frontend, the cookie
     * is stored on the NGROK domain. But the frontend makes API calls
     * to http://localhost:3000, so the cookie is never sent.
     *
     * Fix: store tokens with a 60-second code, redirect through
     * BACKEND_URL/auth/finalize-google (i.e. localhost:3000) which sets
     * the cookie on the LOCAL domain, then forwards to the frontend.
     */
    const code = this.authService.storeOAuthCode({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      needsCountry: result.needsCountry,
    });

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    res.redirect(`${backendUrl}/api/v1/auth/finalize-google?code=${code}`);
  }

  // ─── GOOGLE OAuth — Finalize (hop 2) ─────────────
  /**
   * Second hop of the OAuth redirect chain.
   * This endpoint is always hit on the LOCAL backend domain (localhost:3000),
   * NOT through ngrok. This ensures the refresh_token cookie is set on the
   * same domain the frontend uses for all API calls.
   */
  @Get('finalize-google')
  async finalizeGoogle(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const code = (req.query as Record<string, string>)['code'];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (!code) {
      return res.redirect(`${frontendUrl}/auth/error?reason=missing_code`);
    }

    const session = this.authService.redeemOAuthCode(code);
    if (!session) {
      return res.redirect(`${frontendUrl}/auth/error?reason=invalid_or_expired_code`);
    }

    // Cookie is now set on http://localhost:3000 — the domain the frontend calls
    this.setRefreshTokenCookie(req, res, session.refreshToken);

    const redirectUrl = `${frontendUrl}/auth/callback?token=${session.accessToken}&fullName=${encodeURIComponent(session.user.fullName)}&needsCountry=${session.needsCountry}`;
    return res.redirect(redirectUrl);
  }

  // ─── SET PASSWORD (FOR GOOGLE USERS) ─────────────
  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetPasswordDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.setPassword(user.sub, dto.newPassword, ipAddress);
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────

  private setRefreshTokenCookie(req: Request, res: Response, token: string): void {
    const isProd = process.env.NODE_ENV !== 'development';
    const isHttps = req.secure || req.get('x-forwarded-proto') === 'https';

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProd || isHttps,
      sameSite: isHttps ? 'none' : 'lax', // 'none' + secure allows cross-site (ngrok), 'lax' for same-site (localhost)
      maxAge: SEVEN_DAYS_MS,
      path: '/',
    });
  }
}





