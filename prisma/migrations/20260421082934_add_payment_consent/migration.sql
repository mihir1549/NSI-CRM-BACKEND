-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "terms_accepted_ip" TEXT,
ADD COLUMN     "terms_version" TEXT;
