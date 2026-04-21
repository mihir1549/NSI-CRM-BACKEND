import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AnalyticsAdminController } from './analytics-admin.controller.js';
import { AnalyticsAdminService } from './analytics-admin.service.js';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

describe('AnalyticsAdminController (e2e cache)', () => {
  let app: INestApplication;
  let getDashboardSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Mock the service so we can spy on it (which represents Prisma being called)
    const mockAnalyticsAdminService = {
      getDashboard: jest.fn().mockResolvedValue({ totalRevenue: 100 }),
    };

    getDashboardSpy = mockAnalyticsAdminService.getDashboard;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        CacheModule.register({ ttl: 300000 }), // 5 minutes
      ],
      controllers: [AnalyticsAdminController],
      providers: [
        {
          provide: AnalyticsAdminService,
          useValue: mockAnalyticsAdminService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await app.close();
  });

  it('Call getDashboard twice with same params -> Prisma (service) called once', async () => {
    await request(app.getHttpServer())
      .get('/admin/analytics/dashboard?from=2026-01-01&to=2026-01-31')
      .expect(200);

    await request(app.getHttpServer())
      .get('/admin/analytics/dashboard?from=2026-01-01&to=2026-01-31')
      .expect(200);

    expect(getDashboardSpy).toHaveBeenCalledTimes(1);
  });

  it('Call with different params -> Prisma called again', async () => {
    await request(app.getHttpServer())
      .get('/admin/analytics/dashboard?from=2026-01-01&to=2026-01-31')
      .expect(200);

    await request(app.getHttpServer())
      .get('/admin/analytics/dashboard?from=2026-02-01&to=2026-02-28')
      .expect(200);

    expect(getDashboardSpy).toHaveBeenCalledTimes(2);
  });

  it('After TTL expiry -> Prisma called again (writing to DB does NOT invalidate cache, 5-min staleness is accepted)', async () => {
    jest.useFakeTimers({ advanceTimers: true });

    await request(app.getHttpServer())
      .get('/admin/analytics/dashboard?from=2026-01-01&to=2026-01-31')
      .expect(200);

    expect(getDashboardSpy).toHaveBeenCalledTimes(1);

    // Fast-forward time past 5 minutes (300000 ms)
    jest.advanceTimersByTime(300001);

    await request(app.getHttpServer())
      .get('/admin/analytics/dashboard?from=2026-01-01&to=2026-01-31')
      .expect(200);

    expect(getDashboardSpy).toHaveBeenCalledTimes(2);
  });
});
