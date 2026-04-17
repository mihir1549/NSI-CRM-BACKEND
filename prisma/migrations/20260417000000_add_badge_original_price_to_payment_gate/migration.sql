-- AlterTable
ALTER TABLE "payment_gate_configs" ADD COLUMN "badge" TEXT;
ALTER TABLE "payment_gate_configs" ADD COLUMN "originalPrice" DECIMAL(65,30);
