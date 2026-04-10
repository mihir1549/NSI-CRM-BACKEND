import { Test, TestingModule } from '@nestjs/testing';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: { findFirst: jest.fn() },
  userAcquisition: { upsert: jest.fn(), findUnique: jest.fn() },
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
  });

  describe('capture', () => {
    it('stores acquisition data in a cookie', async () => {
      const mockReq: any = {
        headers: { 'x-forwarded-for': '123.45.67.89' },
        res: { cookie: jest.fn() },
      };

      await service.capture({ utmSource: 'google', distributorCode: 'JOHN123' }, mockReq);

      expect(mockReq.res.cookie).toHaveBeenCalledWith(
        'nsi_acquisition',
        expect.stringContaining('"utmSource":"google"'),
        expect.any(Object),
      );
    });

    it('resolves distributorCode to distributorUuid if active', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ uuid: 'distr-123', joinLinkActive: true });
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
        })
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
        })
      );
      expect(mockReq.res.clearCookie).toHaveBeenCalledWith('nsi_acquisition');
    });

    it('aborts silently if cookie is missing', async () => {
      const mockReq: any = { cookies: {}, res: { clearCookie: jest.fn() } };
      await service.attachToUser('user-1', mockReq);
      expect(mockPrisma.userAcquisition.upsert).not.toHaveBeenCalled();
    });

    it('aborts if user already has an acquisition record', async () => {
      mockPrisma.userAcquisition.findUnique.mockResolvedValue({ id: 1 });
      const mockReq: any = {
        cookies: { nsi_acquisition: JSON.stringify({ utmSource: 'twitter' }) },
      };

      await service.attachToUser('user-1', mockReq);

      expect(mockPrisma.userAcquisition.upsert).not.toHaveBeenCalled();
    });
  });
});
