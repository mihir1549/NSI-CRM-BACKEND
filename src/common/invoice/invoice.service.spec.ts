import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mock prisma.payment ─────────────────────────────────────────────────────
const mockPayment = {
  findFirst: jest.fn(),
};

const mockTx = { payment: mockPayment };

const mockPrisma = {
  payment: mockPayment,
  $transaction: jest.fn(),
};

describe('InvoiceService', () => {
  let service: InvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    jest.clearAllMocks();

    // Re-apply $transaction mock after clearAllMocks
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
    );
  });

  // ══════════════════════════════════════════════════════════
  // generateInvoiceNumber()
  // ══════════════════════════════════════════════════════════
  describe('generateInvoiceNumber()', () => {
    it('returns INV-YYYY-000001 when no existing invoices', async () => {
      mockPayment.findFirst.mockResolvedValue(null);

      const result = await service.generateInvoiceNumber();
      const year = new Date().getFullYear();

      expect(result).toBe(`INV-${year}-000001`);
    });

    it('increments sequence from last invoice number', async () => {
      const year = new Date().getFullYear();
      mockPayment.findFirst.mockResolvedValue({
        invoiceNumber: `INV-${year}-000001`,
      });

      const result = await service.generateInvoiceNumber();

      expect(result).toBe(`INV-${year}-000002`);
    });

    it('pads sequence number to 6 digits', async () => {
      const year = new Date().getFullYear();
      mockPayment.findFirst.mockResolvedValue({
        invoiceNumber: `INV-${year}-000009`,
      });

      const result = await service.generateInvoiceNumber();

      expect(result).toBe(`INV-${year}-000010`);
    });

    it('uses current year in prefix', async () => {
      mockPayment.findFirst.mockResolvedValue(null);

      const result = await service.generateInvoiceNumber();
      const year = new Date().getFullYear();

      expect(result).toMatch(new RegExp(`^INV-${year}-\\d{6}$`));
    });

    it('wraps the DB query in a prisma.$transaction', async () => {
      mockPayment.findFirst.mockResolvedValue(null);

      await service.generateInvoiceNumber();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
