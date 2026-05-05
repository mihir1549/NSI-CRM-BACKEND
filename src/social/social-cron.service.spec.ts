import { Test, TestingModule } from '@nestjs/testing';
import { SocialCronService } from './social-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialPostService } from './social-post.service';
import { SocialConfigService } from './social-config.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDistributors(count: number) {
  return Array.from({ length: count }, (_, i) => ({ uuid: `dist-uuid-${i + 1}` }));
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: { findMany: jest.fn() },
};

const mockSocialPostService = {
  generatePostsForDistributor: jest.fn(),
};

const mockConfigService = {
  getNumber: jest.fn(),
  get: jest.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('SocialCronService', () => {
  let service: SocialCronService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SocialPostService, useValue: mockSocialPostService },
        { provide: SocialConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SocialCronService>(SocialCronService);

    // Default: BATCH_SIZE = 10
    mockConfigService.getNumber.mockResolvedValue(10);
  });

  describe('generateDailyPosts', () => {
    it('calls generatePostsForDistributor for each active distributor', async () => {
      const distributors = makeDistributors(3);
      mockPrisma.user.findMany.mockResolvedValue(distributors);
      mockSocialPostService.generatePostsForDistributor.mockResolvedValue(
        undefined,
      );

      await service.generateDailyPosts();

      expect(
        mockSocialPostService.generatePostsForDistributor,
      ).toHaveBeenCalledTimes(3);
      expect(
        mockSocialPostService.generatePostsForDistributor,
      ).toHaveBeenCalledWith('dist-uuid-1');
      expect(
        mockSocialPostService.generatePostsForDistributor,
      ).toHaveBeenCalledWith('dist-uuid-3');
    });

    it('processes in batches of BATCH_SIZE', async () => {
      mockConfigService.getNumber.mockResolvedValue(2); // BATCH_SIZE=2
      const distributors = makeDistributors(5);
      mockPrisma.user.findMany.mockResolvedValue(distributors);
      mockSocialPostService.generatePostsForDistributor.mockResolvedValue(
        undefined,
      );

      await service.generateDailyPosts();

      // All 5 should be processed regardless of batch size
      expect(
        mockSocialPostService.generatePostsForDistributor,
      ).toHaveBeenCalledTimes(5);
    });

    it('continues when one distributor fails (allSettled)', async () => {
      const distributors = makeDistributors(3);
      mockPrisma.user.findMany.mockResolvedValue(distributors);

      mockSocialPostService.generatePostsForDistributor
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Gemini API error'))
        .mockResolvedValueOnce(undefined);

      await expect(service.generateDailyPosts()).resolves.not.toThrow();

      expect(
        mockSocialPostService.generatePostsForDistributor,
      ).toHaveBeenCalledTimes(3);
    });

    it('queries only distributors with active or grace subscription', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockSocialPostService.generatePostsForDistributor.mockResolvedValue(
        undefined,
      );

      await service.generateDailyPosts();

      const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
      expect(findManyCall.where.role).toBe('DISTRIBUTOR');
      expect(findManyCall.where.status).toBe('ACTIVE');
      expect(findManyCall.where.distributorSubscription.status.in).toContain(
        'ACTIVE',
      );
      expect(findManyCall.where.distributorSubscription.status.in).toContain(
        'GRACE',
      );
    });
  });
});
