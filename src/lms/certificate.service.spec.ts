import { Test, TestingModule } from '@nestjs/testing';
import { CertificateService } from './certificate.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { STORAGE_PROVIDER } from '../common/storage/storage-provider.interface';

// ─── Mock puppeteer ───────────────────────────────────────────────────────────
const mockPage = { setContent: jest.fn(), pdf: jest.fn(), close: jest.fn() };
const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
};
jest.mock('puppeteer', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));
import puppeteer from 'puppeteer';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const USER_UUID = '11111111-1111-1111-1111-111111111111';
const COURSE_UUID = '22222222-2222-2222-2222-222222222222';
const ENROLLMENT_UUID = '33333333-3333-3333-3333-333333333333';

const mockEnrollment = {
  uuid: ENROLLMENT_UUID,
  userUuid: USER_UUID,
  courseUuid: COURSE_UUID,
  completedAt: new Date('2026-03-01'),
  certificateUrl: null,
  user: { uuid: USER_UUID, fullName: 'Test User', email: 'user@test.com' },
  course: { uuid: COURSE_UUID, title: 'Test Course' },
};

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPrisma = {
  courseEnrollment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockMailService = {
  sendCertificateReady: jest.fn(),
};

const mockStorageProvider = {
  uploadPdf: jest.fn().mockResolvedValue({
    url: 'https://r2.example.com/nsi-certificates/CERT-ABCD1234.pdf',
    publicId: 'CERT-ABCD1234',
  }),
};

describe('CertificateService', () => {
  let service: CertificateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
        { provide: STORAGE_PROVIDER, useValue: mockStorageProvider },
      ],
    }).compile();

    service = module.get<CertificateService>(CertificateService);
    jest.resetAllMocks();

    mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);
    mockPrisma.courseEnrollment.update.mockResolvedValue({});
    mockStorageProvider.uploadPdf.mockResolvedValue({
      url: 'https://r2.example.com/nsi-certificates/CERT-ABCD1234.pdf',
      publicId: 'CERT-ABCD1234',
    });
    mockMailService.sendCertificateReady.mockReturnValue(undefined);

    // Re-apply puppeteer mock internals after resetAllMocks
    const launchMock =
      (puppeteer as any).launch || (puppeteer as any).default?.launch;
    launchMock?.mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPage.setContent.mockResolvedValue(undefined);
    mockPage.pdf.mockResolvedValue(Buffer.from('%PDF mock content'));
    mockBrowser.close.mockResolvedValue(undefined);

    // Bypass dynamic import inside the service code itself
    jest
      .spyOn(service as any, 'generatePdf')
      .mockResolvedValue(Buffer.from('%PDF mock content'));
  });

  // ══════════════════════════════════════════════════════════
  // generateForEnrollment() — fire-and-forget, returns void
  // ══════════════════════════════════════════════════════════
  describe('generateForEnrollment()', () => {
    it('does not throw and returns void', () => {
      // Fire-and-forget — returns undefined synchronously
      const result = service.generateForEnrollment(ENROLLMENT_UUID);
      expect(result).toBeUndefined();
    });

    it('does not throw even when enrollment not found (error is swallowed)', () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      expect(() =>
        service.generateForEnrollment(ENROLLMENT_UUID),
      ).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════
  // getOrGenerate()
  // ══════════════════════════════════════════════════════════
  describe('getOrGenerate()', () => {
    it('returns existing certificate without regenerating when certificateUrl is set', async () => {
      const existingUrl =
        'https://r2.example.com/nsi-certificates/CERT-EXISTING.pdf';
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        ...mockEnrollment,
        certificateUrl: existingUrl,
      });

      const result = await service.getOrGenerate(ENROLLMENT_UUID);

      expect(result.certificateUrl).toBe(existingUrl);
      expect(result.certificateId).toBe('CERT-EXISTING');
      // Should NOT call uploadPdf since we returned early
      expect(mockStorageProvider.uploadPdf).not.toHaveBeenCalled();
    });

    it('throws an error when enrollment not found', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      await expect(service.getOrGenerate(ENROLLMENT_UUID)).rejects.toThrow(
        'Enrollment not found',
      );
    });

    it('generates PDF when certificateUrl is null and course is completed', async () => {
      // Both calls (getOrGenerate + doGenerate) return same enrollment
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);

      const result = await service.getOrGenerate(ENROLLMENT_UUID);

      expect(result.certificateUrl).toContain('https://r2.example.com');
      expect(result.certificateId).toContain('CERT-');
      expect(mockStorageProvider.uploadPdf).toHaveBeenCalled();
      expect(mockPrisma.courseEnrollment.update).toHaveBeenCalled();
    });

    it('sends certificate ready email after successful generation', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);

      await service.getOrGenerate(ENROLLMENT_UUID);

      expect(mockMailService.sendCertificateReady).toHaveBeenCalledWith(
        mockEnrollment.user.email,
        mockEnrollment.user.fullName,
        mockEnrollment.course.title,
        expect.stringContaining('https://'),
      );
    });

    it('throws when course is not completed (completedAt is null)', async () => {
      // First call returns enrollment (getOrGenerate), second shows no completedAt
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        ...mockEnrollment,
        completedAt: null,
        certificateUrl: null,
      });

      await expect(service.getOrGenerate(ENROLLMENT_UUID)).rejects.toThrow(
        'Course not completed yet',
      );
    });

    it('updates courseEnrollment with the new certificateUrl', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(mockEnrollment);

      await service.getOrGenerate(ENROLLMENT_UUID);

      expect(mockPrisma.courseEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: ENROLLMENT_UUID },
          data: expect.objectContaining({
            certificateUrl: expect.stringContaining('https://'),
          }),
        }),
      );
    });
  });
});
