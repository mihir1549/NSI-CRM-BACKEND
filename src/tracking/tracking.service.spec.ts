import { Test, TestingModule } from '@nestjs/testing';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: { findFirst: jest.fn() },
  userAcquisition: { upsert: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
};

describe('TrackingService', () => {
  let service: TrackingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TrackingService>(TrackingService);
    jest.clearAllMocks();

    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.userAcquisition.upsert.mockResolvedValue({});
    mockPrisma.userAcquisition.findUnique.mockResolvedValue(null);
    mockPrisma.userAcquisition.updateMany.mockResolvedValue({ count: 0 });
  });

  describe('capture', () => {
    it('stores acquisition data in a cookie', async () => {
      const mockReq: any = {
        headers: { 'x-forwarded-for': '123.45.67.89' },
        res: { cookie: jest.fn() },
      };

      await service.capture(
        { utmSource: 'google', distributorCode: 'JOHN123' },
        mockReq,
      );

      expect(mockReq.res.cookie).toHaveBeenCalledWith(
        'nsi_acquisition',
        expect.stringContaining('"utmSource":"google"'),
        expect.any(Object),
      );
    });

    it('resolves distributorCode to distributorUuid if active', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        uuid: 'distr-123',
        joinLinkActive: true,
      });
      const mockReq: any = { headers: {}, res: { cookie: jest.fn() } };

      await service.capture({ distributorCode: 'JOHN123' }, mockReq);

      expect(mockReq.res.cookie).toHaveBeenCalledWith(
        'nsi_acquisition',
        expect.stringContaining('"distributorUuid":"distr-123"'),
        expect.any(Object),
      );
    });

    it('upserts immediately if user is authenticated', async () => {
      const mockReq: any = {
        headers: {},
        res: { cookie: jest.fn() },
        user: { sub: 'user-1' },
      };

      await service.capture({ utmSource: 'fb' }, mockReq);

      expect(mockPrisma.userAcquisition.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userUuid: 'user-1' },
          create: expect.objectContaining({ utmSource: 'fb' }),
        }),
      );
    });
  });

  describe('attachToUser', () => {
    it('upserts from cookie and clears cookie', async () => {
      const mockReq: any = {
        cookies: { nsi_acquisition: JSON.stringify({ utmSource: 'twitter' }) },
        res: { clearCookie: jest.fn() },
      };

      await service.attachToUser('user-1', mockReq);

      expect(mockPrisma.userAcquisition.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userUuid: 'user-1' },
          create: expect.objectContaining({ utmSource: 'twitter' }),
          update: expect.objectContaining({ utmSource: 'twitter' }),
        }),
      );
      expect(mockReq.res.clearCookie).toHaveBeenCalledWith('nsi_acquisition');
    });

    it('aborts silently if cookie is missing', async () => {
      const mockReq: any = { cookies: {}, res: { clearCookie: jest.fn() } };
      await service.attachToUser('user-1', mockReq);
      expect(mockPrisma.userAcquisition.upsert).not.toHaveBeenCalled();
    });

    it('aborts silently if cookie is malformed JSON', async () => {
      const mockReq: any = {
        cookies: { nsi_acquisition: 'not-json' },
        res: { clearCookie: jest.fn() },
      };
      await service.attachToUser('user-1', mockReq);
      expect(mockPrisma.userAcquisition.upsert).not.toHaveBeenCalled();
    });

    it('continues to upsert even if user already has an acquisition record (merge)', async () => {
      // In previous version this returned early. Now it should call upsert.
      mockPrisma.userAcquisition.findUnique.mockResolvedValue({ id: 1 });
      const mockReq: any = {
        cookies: { nsi_acquisition: JSON.stringify({ utmSource: 'twitter' }) },
        res: { clearCookie: jest.fn() },
      };

      await service.attachToUser('user-1', mockReq);

      expect(mockPrisma.userAcquisition.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userUuid: 'user-1' },
          update: expect.objectContaining({ utmSource: 'twitter' }),
        }),
      );
    });
  });

  // ─── TR2: first-touch distributorUuid protection ─────────────────────────
  describe('first-touch attribution protection', () => {
    it('uses updateMany with distributorUuid: null guard to prevent overwriting', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        uuid: 'distr-A',
        joinLinkActive: true,
      });
      const mockReq: any = {
        headers: {},
        res: { cookie: jest.fn() },
        user: { sub: 'user-1' },
      };

      await service.capture({ distributorCode: 'A123' }, mockReq);

      expect(mockPrisma.userAcquisition.updateMany).toHaveBeenCalledWith({
        where: { userUuid: 'user-1', distributorUuid: null },
        data: { distributorUuid: 'distr-A' },
      });
    });

    it('does not call updateMany when no distributorUuid resolved', async () => {
      // distributorCode omitted — no distributor lookup
      const mockReq: any = {
        headers: {},
        res: { cookie: jest.fn() },
        user: { sub: 'user-1' },
      };

      await service.capture({ utmSource: 'google' }, mockReq);

      expect(mockPrisma.userAcquisition.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── TR3: CF-Connecting-IP preference ────────────────────────────────────
  describe('IP extraction', () => {
    it('prefers CF-Connecting-IP over X-Forwarded-For', async () => {
      const mockReq: any = {
        headers: {
          'cf-connecting-ip': '9.9.9.9',
          'x-forwarded-for': '1.2.3.4',
        },
        res: { cookie: jest.fn() },
      };

      await service.capture({}, mockReq);

      expect(mockReq.res.cookie).toHaveBeenCalledWith(
        'nsi_acquisition',
        expect.stringContaining('"ipAddress":"9.9.9.9"'),
        expect.any(Object),
      );
    });

    it('falls back to X-Forwarded-For when CF-Connecting-IP is absent', async () => {
      const mockReq: any = {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        res: { cookie: jest.fn() },
      };

      await service.capture({}, mockReq);

      expect(mockReq.res.cookie).toHaveBeenCalledWith(
        'nsi_acquisition',
        expect.stringContaining('"ipAddress":"1.2.3.4"'),
        expect.any(Object),
      );
    });
  });
});
