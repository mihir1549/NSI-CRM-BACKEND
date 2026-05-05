import { Test, TestingModule } from '@nestjs/testing';
import { SocialPostService } from './social-post.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../common/gemini/gemini.service';
import { SocialConfigService } from './social-config.service';
import { SocialPostStatus } from '@prisma/client';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const DISTRIBUTOR_UUID = 'dist-uuid-111';

const mockPreference = {
  uuid: 'pref-uuid-1',
  distributorUuid: DISTRIBUTOR_UUID,
  selectedLanguages: ['hi', 'en'],
  selectedTopics: ['HEALTH', 'BUSINESS'],
  autoPostEnabled: false,
  autoDmEnabled: true,
  autoWhatsApp: true,
  notifyOnSources: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDistributor = {
  distributorCode: 'RAJ123',
  fullName: 'Raj Kumar',
};

const mockTopics = [
  {
    uuid: 't1',
    code: 'HEALTH',
    label: 'Health & Wellness',
    geminiPromptHint: 'alkaline ionized water',
    isActive: true,
    order: 1,
    createdAt: new Date(),
  },
  {
    uuid: 't2',
    code: 'BUSINESS',
    label: 'Business & Income',
    geminiPromptHint: 'network marketing',
    isActive: true,
    order: 2,
    createdAt: new Date(),
  },
];

const mockLanguages = [
  {
    uuid: 'l1',
    code: 'hi',
    label: 'Hindi',
    isActive: true,
    order: 1,
    createdAt: new Date(),
  },
  {
    uuid: 'l2',
    code: 'en',
    label: 'English',
    isActive: true,
    order: 2,
    createdAt: new Date(),
  },
];

const mockPost = {
  uuid: 'post-uuid-1',
  distributorUuid: DISTRIBUTOR_UUID,
  type: 'HEALTH',
  languageCode: 'hi',
  topicCode: 'HEALTH',
  caption: 'Test caption',
  hashtags: ['NSI', 'Health'],
  imageUrl: 'https://r2.dev/test.png',
  imagePrompt: 'test prompt',
  status: SocialPostStatus.PENDING,
  platforms: [],
  scheduledAt: null,
  postedAt: null,
  metaPostIds: null,
  generatedFor: new Date(),
  retryCount: 0,
  failureReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPrisma = {
  socialPreference: { findUnique: jest.fn() },
  socialPost: { count: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  socialTopic: { findMany: jest.fn() },
  socialLanguage: { findMany: jest.fn() },
};

const mockGemini = {
  generateCaption: jest.fn(),
  generateImage: jest.fn(),
};

const mockConfig = {
  getNumber: jest.fn(),
  get: jest.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────
describe('SocialPostService', () => {
  let service: SocialPostService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialPostService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GeminiService, useValue: mockGemini },
        { provide: SocialConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<SocialPostService>(SocialPostService);

    // Default config values
    mockConfig.getNumber.mockImplementation(
      (key: string, def: number) => {
        const values: Record<string, number> = {
          POSTS_PER_DAY: 2,
          RETRY_ATTEMPTS: 0, // no retries by default in tests — fast
          RETRY_DELAY_MS: 0,
        };
        return Promise.resolve(values[key] ?? def);
      },
    );
  });

  // ── generatePostsForDistributor ───────────────────────────────────────────

  describe('generatePostsForDistributor', () => {
    it('throws when no SocialPreference found', async () => {
      mockPrisma.socialPreference.findUnique.mockResolvedValue(null);

      await expect(
        service.generatePostsForDistributor(DISTRIBUTOR_UUID),
      ).rejects.toThrow('No social preference set — skipping');
    });

    it('skips when already generated today (count >= POSTS_PER_DAY)', async () => {
      mockPrisma.socialPreference.findUnique.mockResolvedValue(mockPreference);
      mockPrisma.socialPost.count.mockResolvedValue(2); // already 2 posts today

      await service.generatePostsForDistributor(DISTRIBUTOR_UUID);

      expect(mockPrisma.socialPost.create).not.toHaveBeenCalled();
    });

    it('saves FAILED record after all retries exhausted', async () => {
      mockPrisma.socialPreference.findUnique.mockResolvedValue(mockPreference);
      mockPrisma.socialPost.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributor);
      mockPrisma.socialTopic.findMany.mockResolvedValue(mockTopics);
      mockPrisma.socialLanguage.findMany.mockResolvedValue(mockLanguages);
      mockPrisma.socialPost.create.mockResolvedValue({});

      mockGemini.generateCaption.mockRejectedValue(
        new Error('API quota exceeded'),
      );

      await service.generatePostsForDistributor(DISTRIBUTOR_UUID);

      // Should create FAILED records (2 posts, each fails)
      const failedCalls = mockPrisma.socialPost.create.mock.calls.filter(
        (call) => call[0].data.status === SocialPostStatus.FAILED,
      );
      expect(failedCalls.length).toBeGreaterThan(0);
      expect(failedCalls[0][0].data.failureReason).toBe('API quota exceeded');
    });

    it('creates SocialPost with PENDING status on success', async () => {
      mockPrisma.socialPreference.findUnique.mockResolvedValue(mockPreference);
      mockPrisma.socialPost.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue(mockDistributor);
      mockPrisma.socialTopic.findMany.mockResolvedValue(mockTopics);
      mockPrisma.socialLanguage.findMany.mockResolvedValue(mockLanguages);
      mockPrisma.socialPost.create.mockResolvedValue(mockPost);

      mockGemini.generateCaption.mockResolvedValue({
        caption: 'Great health post',
        hashtags: ['NSI', 'Health'],
        language: 'hi',
        topic: 'HEALTH',
      });
      mockGemini.generateImage.mockResolvedValue({
        imageUrl: 'https://r2.dev/img.png',
        r2Key: 'social-posts/dist/2025-05-01/HEALTH-uuid.png',
        prompt: 'image prompt',
      });

      await service.generatePostsForDistributor(DISTRIBUTOR_UUID);

      const pendingCalls = mockPrisma.socialPost.create.mock.calls.filter(
        (call) => call[0].data.status === SocialPostStatus.PENDING,
      );
      expect(pendingCalls.length).toBeGreaterThan(0);
      expect(pendingCalls[0][0].data.distributorUuid).toBe(DISTRIBUTOR_UUID);
    });
  });

  // ── getMyPosts ────────────────────────────────────────────────────────────

  describe('getMyPosts', () => {
    it('returns posts filtered by today', async () => {
      mockPrisma.socialPost.findMany.mockResolvedValue([mockPost]);

      const result = await service.getMyPosts(DISTRIBUTOR_UUID, 'today');

      expect(result).toEqual([mockPost]);
      expect(mockPrisma.socialPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorUuid: DISTRIBUTOR_UUID,
            generatedFor: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('returns posts filtered by 7days', async () => {
      mockPrisma.socialPost.findMany.mockResolvedValue([mockPost]);

      await service.getMyPosts(DISTRIBUTOR_UUID, '7days');

      expect(mockPrisma.socialPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            generatedFor: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('excludes FAILED posts from distributor view', async () => {
      mockPrisma.socialPost.findMany.mockResolvedValue([]);

      await service.getMyPosts(DISTRIBUTOR_UUID, 'today');

      const call = mockPrisma.socialPost.findMany.mock.calls[0][0];
      expect(call.where.status).toEqual({ not: SocialPostStatus.FAILED });
    });
  });
});
