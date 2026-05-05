import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  GeminiService,
  GeminiException,
  GeneratedCaption,
  GeneratedImage,
} from './gemini.service.js';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  UploadResult,
} from '../storage/storage-provider.interface.js';

jest.mock('@google/generative-ai');

const CAPTION_PARAMS = {
  languageCode: 'hi',
  languageLabel: 'Hindi',
  topicCode: 'HEALTH',
  topicLabel: 'Health & Wellness',
  geminiPromptHint: 'alkaline ionized water health benefits',
  distributorName: 'Raj Kumar',
  joinLink: 'growithnsi.com/join/RAJ123',
  postsPerDay: 2,
};

const IMAGE_PARAMS = {
  topicCode: 'HEALTH',
  topicLabel: 'Health & Wellness',
  geminiPromptHint: 'alkaline ionized water health benefits',
  languageCode: 'hi',
  distributorUuid: 'dist-uuid-123',
  generatedFor: '2025-05-01',
};

function buildConfigService(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    GEMINI_API_KEY: 'test-api-key',
    GEMINI_TEXT_MODEL: 'gemini-1.5-pro',
    GEMINI_IMAGE_MODEL: 'imagen-3.0-generate-001',
    GEMINI_ENABLED: 'true',
    R2_PUBLIC_URL: 'https://pub-test.r2.dev',
    ...overrides,
  };
  return {
    get: jest.fn(
      <T = string>(key: string, def?: T): T =>
        ((defaults[key] as T) ?? def) as T,
    ),
  };
}

function buildStorageMock(): jest.Mocked<IStorageProvider> {
  return {
    uploadFile: jest.fn(),
    uploadPdf: jest.fn(),
  };
}

describe('GeminiService', () => {
  let mockGenerativeModel: { generateContent: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGenerativeModel = { generateContent: jest.fn() };

    const { GoogleGenerativeAI } = jest.requireMock('@google/generative-ai');
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue(mockGenerativeModel),
    }));
  });

  // ── generateCaption ─────────────────────────────────────

  describe('generateCaption', () => {
    it('returns a valid GeneratedCaption shape', async () => {
      const configService = buildConfigService();
      const storageProvider = buildStorageMock();
      const service = new GeminiService(
        configService as unknown as ConfigService,
        storageProvider,
      );

      mockGenerativeModel.generateContent.mockResolvedValue({
        response: {
          text: () =>
            'Kya aap jaante hain ki alkaline ionized water aapki energy badha sakta hai? Personal experience se mujhe bahut fark pada hai. Yeh amazing hai!\n\ngrowithnsi.com/join/RAJ123\nComment \'INFO\' for details!\n\nHASHTAGS: AlkalineWater, NSI, HealthyLiving, WellnessIndia, FitIndia, EnergyBoost, HealthTips, HydrationGoals',
        },
      });

      const result: GeneratedCaption = await service.generateCaption(
        CAPTION_PARAMS,
      );

      expect(typeof result.caption).toBe('string');
      expect(result.caption.length).toBeGreaterThan(0);
      expect(Array.isArray(result.hashtags)).toBe(true);
      expect(result.hashtags.length).toBeGreaterThan(0);
      expect(result.hashtags.every((h) => !h.startsWith('#'))).toBe(true);
      expect(result.language).toBe('hi');
      expect(result.topic).toBe('HEALTH');
    });

    it('throws when GEMINI_ENABLED is false', async () => {
      const configService = buildConfigService({ GEMINI_ENABLED: 'false' });
      const storageProvider = buildStorageMock();
      const service = new GeminiService(
        configService as unknown as ConfigService,
        storageProvider,
      );

      await expect(service.generateCaption(CAPTION_PARAMS)).rejects.toThrow(
        'Gemini is disabled',
      );
    });

    it('throws GeminiException on API error', async () => {
      const configService = buildConfigService();
      const storageProvider = buildStorageMock();
      const service = new GeminiService(
        configService as unknown as ConfigService,
        storageProvider,
      );

      mockGenerativeModel.generateContent.mockRejectedValue(
        new Error('API quota exceeded'),
      );

      await expect(service.generateCaption(CAPTION_PARAMS)).rejects.toThrow(
        GeminiException,
      );
    });
  });

  // ── generateImage ───────────────────────────────────────

  describe('generateImage', () => {
    it('uploads to R2 and returns public URL', async () => {
      const configService = buildConfigService();
      const storageProvider = buildStorageMock();
      const service = new GeminiService(
        configService as unknown as ConfigService,
        storageProvider,
      );

      const fakeBuffer = Buffer.from('fake-image-data');
      jest
        .spyOn(service as unknown as { callImagenApi: () => Promise<Buffer> }, 'callImagenApi')
        .mockResolvedValue(fakeBuffer);

      const uploadResult: UploadResult = {
        url: 'https://pub-test.r2.dev/social-posts/dist-uuid-123/2025-05-01/HEALTH-abc.png',
        publicId:
          'social-posts/dist-uuid-123/2025-05-01/HEALTH-abc.png',
      };
      storageProvider.uploadFile.mockResolvedValue(uploadResult);

      const result: GeneratedImage = await service.generateImage(IMAGE_PARAMS);

      expect(result.imageUrl).toBe(uploadResult.url);
      expect(result.r2Key).toBe(uploadResult.publicId);
      expect(typeof result.prompt).toBe('string');
      expect(result.prompt.length).toBeGreaterThan(0);
      expect(storageProvider.uploadFile).toHaveBeenCalledWith(
        fakeBuffer,
        `social-posts/${IMAGE_PARAMS.distributorUuid}/${IMAGE_PARAMS.generatedFor}`,
        expect.stringContaining('HEALTH'),
        'image/png',
      );
    });

    it('throws when GEMINI_ENABLED is false', async () => {
      const configService = buildConfigService({ GEMINI_ENABLED: 'false' });
      const storageProvider = buildStorageMock();
      const service = new GeminiService(
        configService as unknown as ConfigService,
        storageProvider,
      );

      await expect(service.generateImage(IMAGE_PARAMS)).rejects.toThrow(
        'Gemini is disabled',
      );
    });
  });

  // ── constructor guard ────────────────────────────────────

  describe('constructor', () => {
    it('throws when GEMINI_ENABLED=true and API key is missing', () => {
      const configService = buildConfigService({ GEMINI_API_KEY: '' });
      const storageProvider = buildStorageMock();

      expect(
        () =>
          new GeminiService(
            configService as unknown as ConfigService,
            storageProvider,
          ),
      ).toThrow('GEMINI_API_KEY must be configured');
    });
  });
});
