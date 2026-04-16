/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars */
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
import { StepType, UserRole, UserStatus } from '@prisma/client';

class TestMailService implements IEmailService {
  async sendOTP(to: string, name: string, otp: string): Promise<void> {}
  async sendWelcome(to: string, name: string): Promise<void> {}
  async sendPasswordResetOTP(
    to: string,
    name: string,
    otp: string,
  ): Promise<void> {}
  async sendNurtureSequence(to: string, name: string): Promise<void> {}
}

describe('Funnel Engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testEmail = `funnel-test-${Date.now()}@example.com`;
  const adminEmail = `admin-test-${Date.now()}@example.com`;
  let userUuid: string;
  let adminUuid: string;
  let userAccessToken: string;
  let adminAccessToken: string;
  let sectionUuid: string;
  let stepUuid: string;
  let decisionStepUuid: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_SERVICE_TOKEN)
      .useValue(new TestMailService())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
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

    // 1. Create Test User
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        fullName: 'Funnel Test User',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        country: 'IN',
      },
    });
    userUuid = user.uuid;

    // 2. Create Admin User
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'Funnel Admin User',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        country: 'IN',
      },
    });
    adminUuid = admin.uuid;

    // 3. Seed Funnel Structure
    const section = await prisma.funnelSection.create({
      data: {
        name: 'Test Section',
        order: 1,
        isActive: true,
        steps: {
          create: [
            {
              type: StepType.VIDEO_TEXT,
              order: 1,
              isActive: true,
              content: {
                create: {
                  title: 'Test Video Step',
                  videoUrl: 'https://iframe.bunny.net/play/123',
                  videoDuration: 10,
                  requireVideoCompletion: true,
                },
              },
            },
            {
              type: StepType.DECISION,
              order: 2,
              isActive: true,
              decisionStep: {
                create: {
                  question: 'Want a machine?', // Fixed: using question instead of title
                  yesLabel: 'Bring it on',
                  noLabel: 'Not now',
                },
              },
            },
          ],
        },
      },
      include: { steps: true },
    });
    sectionUuid = section.uuid;
    const steps = (section as any).steps; // Fixed: bypass type error for included steps
    stepUuid = steps.find((s: any) => s.type === StepType.VIDEO_TEXT)!.uuid;
    decisionStepUuid = steps.find(
      (s: any) => s.type === StepType.DECISION,
    )!.uuid;

    // 4. Generate Tokens (Simulate Login)
    // For simplicity, we'll manually trigger the token generation or use the AuthService if available.
    // In actual E2E, we'd call /auth/login, but here we can use a helper if we have one.
    // Let's call /auth/login to be safe.
    // But wait, we don't have passwords for these users yet. Let's update them with a password hash.
    const passwordHash =
      '$2b$12$PwJG70CPRJznRYa/lyWUbeu3QKLvuM74xqxJ55ZMj19J09LeS9nHO'; // Pre-hashed 'Password123!'
    await prisma.user.update({
      where: { uuid: userUuid },
      data: { passwordHash },
    });
    await prisma.user.update({
      where: { uuid: adminUuid },
      data: { passwordHash },
    });

    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'Password123!' });
    userAccessToken = userLogin.body.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'Password123!' });
    adminAccessToken = adminLogin.body.accessToken;

    // Update admin user to SUPER_ADMIN as required by FunnelCmsController
    await prisma.user.update({
      where: { uuid: adminUuid },
      data: { role: UserRole.SUPER_ADMIN },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { uuid: { in: [userUuid, adminUuid] } },
    });
    await prisma.funnelSection.delete({ where: { uuid: sectionUuid } });
    await app.close();
  });

  describe('User Routes', () => {
    it('GET /funnel/structure - Success', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/funnel/structure')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.sections).toBeDefined();
      expect(res.body.sections.length).toBeGreaterThan(0);
      expect(res.body.sections[0].name).toBe('Test Section');
    });

    it('GET /funnel/step/:uuid - Success', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/funnel/step/${stepUuid}`)
        .set('Authorization', `Bearer ${userAccessToken}`);

      if (res.status !== 200) console.log('GET step failed:', res.body);
      expect(res.status).toBe(200);
      expect(res.body.content.title).toBeDefined(); // Fixed: nested in content
    });

    it('POST /funnel/decision - Success', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/funnel/decision')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ answer: 'YES', stepUuid: decisionStepUuid }); // Fixed: using correct UUID

      if (res.status !== 201) console.log('POST decision failed:', res.body);
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('Admin CMS Routes', () => {
    let newSectionUuid: string;

    it('GET /admin/funnel/sections - Success as Admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/funnel/sections')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /admin/funnel/sections - Success as Admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/funnel/sections')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'New API Section', order: 2 });

      expect(res.status).toBe(201);
      newSectionUuid = res.body.uuid;
      expect(newSectionUuid).toBeDefined();
    });

    it('PATCH /admin/funnel/sections/:uuid - Success', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/funnel/sections/${newSectionUuid}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
    });

    it('GET /admin/funnel/validate - Success', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/funnel/validate')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      if (res.status !== 200) console.log('GET validate failed:', res.body);
      expect(res.status).toBe(200);
      expect(res.body.warnings).toBeDefined(); // Fixed: API returns { warnings }
    });

    it('GET /admin/funnel/sections - Fail as User', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/funnel/sections')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Admin Analytics Routes', () => {
    it('GET /admin/analytics/funnel - Success', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/funnel')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /admin/analytics/utm - Success', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/utm')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /admin/analytics/devices - Success', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/devices')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /admin/analytics/conversions - Success', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/conversions')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Public Routes', () => {
    it('POST /tracking/capture - Success without Auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tracking/capture')
        .set('User-Agent', 'Mozilla/5.0')
        .send({ utmSource: 'test-source', utmMedium: 'test-medium' });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
    });
  });
});
