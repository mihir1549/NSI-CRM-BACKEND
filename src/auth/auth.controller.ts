import {
  Controller,
  Post,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  AuthResponse,
  MeResponse,
  AvatarUploadResponse,
} from './dto/responses/auth.responses.js';
import {
  MessageResponse,
  ErrorResponse,
} from '../common/dto/responses/error.response.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResendOtpDto } from './dto/resend-otp.dto.js';
import { CompleteProfileDto } from './dto/complete-profile.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';
import { UsersService } from '../users/users.service.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  // ─── STEP 1: SIGNUP ──────────────────────────────────
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User created, OTP sent to email',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or email already exists',
    type: ErrorResponse,
  })
  @Post('signup')
  @Throttle({ strict: { limit: 5, ttl: 900000 } }) // 5 per 15 min
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.signup(
      dto.fullName,
      dto.email,
      dto.password,
      ipAddress,
      dto.referralCode,
    );
  }

  // ─── STEP 2: VERIFY EMAIL OTP + AUTO LOGIN ───────────
  @ApiOperation({ summary: 'Verify email OTP and auto-login' })
  @ApiResponse({
    status: 200,
    description: 'OTP verified, returns access token',
    type: AuthResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP',
    type: ErrorResponse,
  })
  @Post('verify-email-otp')
  @Throttle({ strict: { limit: 10, ttl: 900000 } }) // 10 per 15 min
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
  @ApiOperation({ summary: 'Complete profile with country' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Profile completed',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponse,
  })
  @Post('complete-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'CUSTOMER', 'DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN')
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
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns access token',
    type: AuthResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    type: ErrorResponse,
  })
  @Post('login')
  @Throttle({ strict: { limit: 10, ttl: 900000 } }) // 10 per 15 min
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
  @ApiOperation({ summary: 'Resend email OTP' })
  @ApiResponse({
    status: 200,
    description: 'OTP resent',
    type: MessageResponse,
  })
  @Post('resend-otp')
  @Throttle({ strict: { limit: 3, ttl: 3600000 } }) // 3 per hour
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.resendOtp(dto.email, ipAddress);
  }

  // ─── STEP 6: TOKEN REFRESH ───────────────────────────
  @ApiOperation({ summary: 'Refresh access token using HttpOnly cookie' })
  @ApiResponse({
    status: 200,
    description: 'New access token returned',
    type: AuthResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token missing or invalid',
    type: ErrorResponse,
  })
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
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: MeResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponse,
  })
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'CUSTOMER', 'DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  // ─── UPDATE OWN PROFILE ──────────────────────────────
  @ApiOperation({ summary: 'Update own profile (name, avatar URL)' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    type: MeResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponse,
  })
  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'CUSTOMER', 'DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(user.sub, dto);
    return { user: updated };
  }

  // ─── UPLOAD AVATAR ───────────────────────────────────
  @ApiOperation({ summary: 'Upload profile avatar image' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image (JPG, PNG, WEBP, max 2MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded, returns new avatar URL',
    type: AvatarUploadResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'No file or invalid file type/size',
    type: ErrorResponse,
  })
  @Post('upload-avatar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'CUSTOMER', 'DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File too large. Maximum size is 2MB.');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPG, PNG, or WEBP images are allowed.',
      );
    }

    return this.authService.uploadAvatar(user.sub, file.buffer);
  }

  // ─── STEP 7: LOGOUT ──────────────────────────────────
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: MessageResponse,
  })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
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
        const decoded = this.jwtService.decode(token) as {
          sub?: string;
        } | null;
        userUuid = decoded?.sub;
      }
    } catch {
      // Ignore — logout still proceeds
    }

    const result = await this.authService.logout(
      refreshToken,
      userUuid,
      ipAddress,
    );

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
  @ApiOperation({ summary: 'Send password reset OTP to email' })
  @ApiResponse({
    status: 200,
    description: 'Reset OTP sent',
    type: MessageResponse,
  })
  @Post('forgot-password')
  @Throttle({ strict: { limit: 3, ttl: 3600000 } }) // 3 per hour
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.forgotPassword(dto.email, ipAddress);
  }

  // ─── STEP 9: RESET PASSWORD ──────────────────────────
  @ApiOperation({ summary: 'Reset password using OTP' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP or expired',
    type: ErrorResponse,
  })
  @Post('reset-password')
  @Throttle({ strict: { limit: 5, ttl: 900000 } }) // 5 per 15 min
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.resetPassword(
      dto.email,
      dto.otp,
      dto.newPassword,
      ipAddress,
    );
  }

  // ─── GOOGLE OAuth — Initiate ─────────────────────
  /**
   * Initiates Google OAuth flow.
   * @remarks Redirects to Google — not usable from Swagger UI directly.
   * referralCode is forwarded as OAuth `state` so it survives the Google redirect.
   * On callback, passport-google-oauth20 returns state via req.query.state.
   */
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiQuery({
    name: 'referralCode',
    required: false,
    description: 'Optional distributor referral code',
  })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth' })
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
  @ApiOperation({ summary: 'Google OAuth callback (handled by Google)' })
  @ApiResponse({ status: 302, description: 'Redirects to finalize-google' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
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

    const code = this.authService.storeOAuthCode({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      needsCountry: result.needsCountry,
    });

    res.redirect(`/api/v1/auth/finalize-google?code=${code}`);
  }

  // ─── GOOGLE OAuth — Finalize (hop 2) ─────────────
  /**
   * Second hop of the OAuth redirect chain.
   * @remarks Internal redirect — not called directly by clients.
   * This endpoint is always hit on the LOCAL backend domain (localhost:3000),
   * NOT through ngrok. This ensures the refresh_token cookie is set on the
   * same domain the frontend uses for all API calls.
   */
  @ApiOperation({ summary: 'Finalize Google OAuth and set cookies' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with tokens',
  })
  @Get('finalize-google')
  async finalizeGoogle(@Req() req: Request, @Res() res: Response) {
    const code = (req.query as Record<string, string>)['code'];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!code) {
      return res.redirect(`${frontendUrl}/auth/error?reason=missing_code`);
    }

    const session = this.authService.redeemOAuthCode(code);
    if (!session) {
      return res.redirect(
        `${frontendUrl}/auth/error?reason=invalid_or_expired_code`,
      );
    }

    // Cookie is now set on http://localhost:3000 — the domain the frontend calls
    this.setRefreshTokenCookie(req, res, session.refreshToken);

    const redirectUrl = `${frontendUrl}/auth/callback?token=${session.accessToken}&fullName=${encodeURIComponent(session.user.fullName)}&needsCountry=${session.needsCountry}`;
    return res.redirect(redirectUrl);
  }

  // ─── SET PASSWORD (FOR GOOGLE USERS) ─────────────
  @ApiOperation({ summary: 'Set password for Google OAuth users' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Password set successfully',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponse,
  })
  @Post('set-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'CUSTOMER', 'DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN')
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

  private setRefreshTokenCookie(
    req: Request,
    res: Response,
    token: string,
  ): void {
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
