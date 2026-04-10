import { Test, TestingModule } from '@nestjs/testing';
import { InvoicePdfService, InvoiceData } from './invoice-pdf.service';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';

// ─── Mock puppeteer ──────────────────────────────────────────────────────────
const mockPage = {
  setContent: jest.fn().mockResolvedValue(undefined),
  pdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
};
const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

// ─── Mock storage provider ───────────────────────────────────────────────────
const mockStorageProvider = {
  uploadPdf: jest.fn(),
};

const sampleData: InvoiceData = {
  invoiceNumber: 'INV-2026-000001',
  invoiceDate: new Date('2026-04-09'),
  fullName: 'Rahul Sharma',
  email: 'rahul@example.com',
  planName: 'Pro Plan',
  amount: 999,
  currency: 'INR',
  nextBillingDate: new Date('2026-05-09'),
};

describe('InvoicePdfService', () => {
  let service: InvoicePdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicePdfService,
        { provide: STORAGE_PROVIDER, useValue: mockStorageProvider },
      ],
    }).compile();

    service = module.get<InvoicePdfService>(InvoicePdfService);
    jest.clearAllMocks();

    // Re-apply puppeteer mock after clearAllMocks
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer');
    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPage.setContent.mockResolvedValue(undefined);
    mockPage.pdf.mockResolvedValue(Buffer.from('fake-pdf-content'));
    mockBrowser.close.mockResolvedValue(undefined);

    mockStorageProvider.uploadPdf.mockResolvedValue({
      url: 'https://r2.dev/nsi-invoices/INV-2026-000001.pdf',
      publicId: 'nsi-invoices/INV-2026-000001',
    });
  });

  // ══════════════════════════════════════════════════════════
  // generateAndUpload()
  // ══════════════════════════════════════════════════════════
  describe('generateAndUpload()', () => {
    it('calls uploadPdf with correct folder and filename', async () => {
      await service.generateAndUpload(sampleData);

      expect(mockStorageProvider.uploadPdf).toHaveBeenCalledWith(
        expect.any(Buffer),
        'nsi-invoices',
        'INV-2026-000001',
      );
    });

    it('returns the URL from uploadPdf result', async () => {
      const result = await service.generateAndUpload(sampleData);

      expect(result).toBe('https://r2.dev/nsi-invoices/INV-2026-000001.pdf');
    });

    it('returns null (never throws) when uploadPdf rejects', async () => {
      mockStorageProvider.uploadPdf.mockRejectedValueOnce(new Error('R2 upload failed'));

      const result = await service.generateAndUpload(sampleData);

      expect(result).toBeNull();
    });

    it('returns null (never throws) when puppeteer fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const puppeteer = require('puppeteer');
      (puppeteer.launch as jest.Mock).mockRejectedValueOnce(new Error('Puppeteer crashed'));

      const result = await service.generateAndUpload(sampleData);

      expect(result).toBeNull();
    });

    it('omits next billing section when nextBillingDate is null', async () => {
      const dataWithoutNextBilling: InvoiceData = {
        ...sampleData,
        nextBillingDate: null,
      };

      const result = await service.generateAndUpload(dataWithoutNextBilling);

      // Should still succeed and return URL — no crash from missing nextBillingDate
      expect(result).toBe('https://r2.dev/nsi-invoices/INV-2026-000001.pdf');
      expect(mockStorageProvider.uploadPdf).toHaveBeenCalled();
    });

    it('passes invoiceNumber as the filename to uploadPdf', async () => {
      const customData: InvoiceData = { ...sampleData, invoiceNumber: 'INV-2026-000099' };
      mockStorageProvider.uploadPdf.mockResolvedValueOnce({
        url: 'https://r2.dev/nsi-invoices/INV-2026-000099.pdf',
        publicId: 'nsi-invoices/INV-2026-000099',
      });

      await service.generateAndUpload(customData);

      expect(mockStorageProvider.uploadPdf).toHaveBeenCalledWith(
        expect.any(Buffer),
        'nsi-invoices',
        'INV-2026-000099',
      );
    });
  });
});
