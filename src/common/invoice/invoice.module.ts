import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service.js';
import { InvoicePdfService } from './invoice-pdf.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [StorageModule, PrismaModule],
  providers: [InvoiceService, InvoicePdfService],
  exports: [InvoiceService, InvoicePdfService],
})
export class InvoiceModule {}
