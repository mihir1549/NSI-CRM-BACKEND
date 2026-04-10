-- AlterTable: make gatewayOrderId nullable and add invoiceNumber
ALTER TABLE "payments" ALTER COLUMN "gateway_order_id" DROP NOT NULL;

-- CreateIndex: unique index on gatewayOrderId (was already unique, keep it)
-- (already exists from previous migration)

-- AlterTable: add invoiceNumber column
ALTER TABLE "payments" ADD COLUMN "invoice_number" TEXT;

-- CreateIndex: unique index on invoiceNumber
CREATE UNIQUE INDEX "payments_invoice_number_key" ON "payments"("invoice_number");
