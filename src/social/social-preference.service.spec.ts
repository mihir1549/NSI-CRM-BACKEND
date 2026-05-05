import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SocialPreferenceService } from './social-preference.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialConfigService } from './social-config.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const DISTRIBUTOR_UUID = 'dist-uuid-111';

const mockPreference = {
  uuid: 'pref-uuid-1',
  distributorUuid: DISTRIBUTOR_UUID,
  selectedLanguages: ['hi'],
  selectedTopics: ['HEALTH'],
  autoPostEnabled: false,
  autoDmEnabled: true,
  autoWhatsApp: true,
  notifyOnSources: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockLanguages = [
  { uuid: 'l1', code: 'hi', label: 'Hindi', isActive: true, order: 1, createdAt: new Date() },
  { uuid: 'l2', code: 'en', label: 'English', isActive: true, order: 2, createdAt: new Date() },
];

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  socialPreference: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  socialLanguage: {
    findMany: jest.fn(),
  },
  socialTopic: {
    findMany: jest.fn(),
  },
};

const mockConfigService = {
  getNumber: jest.fn().mockResolvedValue(2), // MAX_LANGUAGES=2
  get: jest.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('SocialPreferenceService', () => {
  let service: SocialPreferenceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.getNumber.mockResolvedValue(2);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialPreferenceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SocialConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SocialPreferenceService>(SocialPreferenceService);
  });

  // ── getPreference ─────────────────────────────────────────────────────────

  describe('getPreference', () => {
    it('returns null when not found', async () => {
      mockPrisma.socialPreference.findUnique.mockResolvedValue(null);

      const result = await service.getPreference(DISTRIBUTOR_UUID);

      expect(result).toBeNull();
      expect(mockPrisma.socialPreference.findUnique).toHaveBeenCalledWith({
        where: { distributorUuid: DISTRIBUTOR_UUID },
      });
    });
  });

  // ── upsertPreference ──────────────────────────────────────────────────────

  describe('upsertPreference', () => {
    it('creates new preference', async () => {
      mockPrisma.socialPreference.upsert.mockResolvedValue(mockPreference);

      const result = await service.upsertPreference(DISTRIBUTOR_UUID, {
        selectedLanguages: ['hi'],
        selectedTopics: ['HEALTH'],
      });

      expect(result).toEqual(mockPreference);
      expect(mockPrisma.socialPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { distributorUuid: DISTRIBUTOR_UUID },
          create: expect.objectContaining({
            distributorUuid: DISTRIBUTOR_UUID,
            selectedLanguages: ['hi'],
          }),
        }),
      );
    });

    it('updates existing preference', async () => {
      const updated = { ...mockPreference, selectedLanguages: ['en'] };
      mockPrisma.socialPreference.upsert.mockResolvedValue(updated);

      const result = await service.upsertPreference(DISTRIBUTOR_UUID, {
        selectedLanguages: ['en'],
      });

      expect(result.selectedLanguages).toEqual(['en']);
    });

    it('throws BadRequestException when selectedLanguages.length > MAX_LANGUAGES', async () => {
      mockConfigService.getNumber.mockResolvedValue(2); // MAX_LANGUAGES=2

      await expect(
        service.upsertPreference(DISTRIBUTOR_UUID, {
          selectedLanguages: ['hi', 'en', 'hinglish'], // 3 > 2
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getAvailableLanguages ─────────────────────────────────────────────────

  describe('getAvailableLanguages', () => {
    it('returns only isActive=true languages ordered by order', async () => {
      mockPrisma.socialLanguage.findMany.mockResolvedValue(mockLanguages);

      const result = await service.getAvailableLanguages();

      expect(result).toEqual(mockLanguages);
      expect(mockPrisma.socialLanguage.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });
    });
  });
});
