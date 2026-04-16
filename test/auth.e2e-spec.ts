/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import {
  EMAIL_SERVICE_TOKEN,
  IEmailService,
} from '../src/mail/providers/mail-provider.interface.js';

class TestMailService implements IEmailService {
  public lastOtp: string | null = null;
  async sendOTP(to: string, name: string, otp: string): Promise<void> {
    this.lastOtp = otp;
    await Promise.resolve();
  }
  async sendWelcome(to: string, name: string): Promise<void> {}
  async sendPasswordResetOTP(
    to: string,
    name: string,
    otp: string,
  ): Promise<void> {
    this.lastOtp = otp;
    await Promise.resolve();
  }
}

describe('Authentication Flow (e2e)', () => {
  let app: INestApplication;
  let testMailService: TestMailService;
  let prisma: PrismaService;

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let refreshTokenCookie: string;
  let accessToken: string;
  let userUuid: string;

  beforeAll(async () => {
    testMailService = new TestMailService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_SERVICE_TOKEN)
      .useValue(testMailService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply same middleware as main.ts
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(cookieParser());

    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (userUuid) {
      await prisma.user.delete({ where: { uuid: userUuid } }).catch(() => {});
    }
    await app.close();
  });

  it('1. POST /auth/signup - Success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        fullName: 'Test User',
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();

    // Check DB
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).toBeDefined();
    expect(user!.status).toBe('REGISTERED');
    expect(testMailService.lastOtp).not.toBeNull();
    userUuid = user!.uuid;
  });

  it('2. POST /auth/verify-email-otp - Success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email-otp')
      .send({
        email: testEmail,
        otp: testMailService.lastOtp,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.needsCountry).toBe(true);
    expect(res.body.user.status).toBe('PROFILE_INCOMPLETE');

    // Extract cookie
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const rtCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(rtCookie).toBeDefined();
    refreshTokenCookie = rtCookie!.split(';')[0];
    accessToken = res.body.accessToken;
  });

  it('3. POST /auth/complete-profile - Require Auth', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/complete-profile')
      .send({ country: 'US' });

    expect(res.status).toBe(401);
  });

  it('4. POST /auth/complete-profile - Success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/complete-profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ country: 'US' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    // Verify DB
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user!.status).toBe('ACTIVE');
    expect(user!.country).toBe('US');
  });

  it('5. POST /auth/login - Success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    // Check cookie rotation
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const rtCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(rtCookie).toBeDefined();
    refreshTokenCookie = rtCookie!.split(';')[0];
  });

  it('6. POST /auth/refresh - Success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${refreshTokenCookie}`]);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    // Cookie rotated
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const rtCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(rtCookie).toBeDefined();
    refreshTokenCookie = rtCookie!.split(';')[0];
  });

  it('7. Rate Limiter - Resend OTP Throttling', async () => {
    // The resend limit is 3 per hour. Let's make 4 requests.
    const requests = [];
    for (let i = 0; i < 3; i++) {
      requests.push(
        request(app.getHttpServer())
          .post('/api/v1/auth/resend-otp')
          .send({ email: testEmail }),
      );
    }
    await Promise.all(requests);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/resend-otp')
      .send({ email: testEmail });

    expect(res.status).toBe(400); // AuthService throws BadRequestException
  });

  it('8. POST /auth/logout - Success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${refreshTokenCookie}`]);

    expect(res.status).toBe(200);

    // Cookie cleared
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.join('')).toContain('refresh_token=;'); // Represents a cleared cookie
  });

  it('9. POST /auth/refresh - Fail after logout', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${refreshTokenCookie}`]);

    expect(res.status).toBe(401);
  });
});
