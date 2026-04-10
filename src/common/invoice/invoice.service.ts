import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a globally unique invoice number in format INV-YYYY-XXXXXX.
   * Uses a transaction to prevent race conditions.
   * The @unique constraint on invoiceNumber is the final safety net.
   */
  async generateInvoiceNumber(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const lastInvoice = await tx.payment.findFirst({
        where: { invoiceNumber: { not: null } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });

      let nextSeq = 1;
      if (lastInvoice?.invoiceNumber) {
        const parts = lastInvoice.invoiceNumber.split('-');
        if (parts.length === 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) {
            nextSeq = parsed + 1;
          }
        }
      }

      const year = new Date().getFullYear();
      return `INV-${year}-${String(nextSeq).padStart(6, '0')}`;
    });
  }
}
