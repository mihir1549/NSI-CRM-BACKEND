-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('COMMITMENT_FEE', 'LMS_COURSE', 'DISTRIBUTOR_SUB');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('FLAT', 'PERCENT', 'FREE');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('COMMITMENT_FEE', 'LMS_COURSE', 'DISTRIBUTOR_SUB', 'ALL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'WARM', 'HOT', 'CONTACTED', 'FOLLOWUP', 'NURTURE', 'LOST', 'MARK_AS_CUSTOMER');

-- CreateEnum
CREATE TYPE "LeadAction" AS ENUM ('STATUS_CHANGE', 'NOTE', 'FOLLOWUP_SCHEDULED');

-- CreateEnum
CREATE TYPE "NurtureStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'UNSUBSCRIBED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "user_profiles" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "payments" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "gatewayOrderId" TEXT NOT NULL,
    "gatewayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "finalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentType" "PaymentType" NOT NULL,
    "couponUuid" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "coupons" (
    "uuid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" INTEGER NOT NULL,
    "applicableTo" "CouponScope" NOT NULL,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "coupon_uses" (
    "uuid" TEXT NOT NULL,
    "couponUuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_uses_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "leads" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "assignedToUuid" TEXT NOT NULL,
    "distributorUuid" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "uuid" TEXT NOT NULL,
    "leadUuid" TEXT NOT NULL,
    "actorUuid" TEXT NOT NULL,
    "fromStatus" "LeadStatus",
    "toStatus" "LeadStatus",
    "action" "LeadAction" NOT NULL,
    "notes" TEXT,
    "followupAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "nurture_enrollments" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "leadUuid" TEXT NOT NULL,
    "status" "NurtureStatus" NOT NULL DEFAULT 'ACTIVE',
    "day1SentAt" TIMESTAMP(3),
    "day3SentAt" TIMESTAMP(3),
    "day7SentAt" TIMESTAMP(3),
    "nextEmailAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nurture_enrollments_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userUuid_key" ON "user_profiles"("userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_phone_key" ON "user_profiles"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayOrderId_key" ON "payments"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "payments_userUuid_idx" ON "payments"("userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_uses_couponUuid_userUuid_key" ON "coupon_uses"("couponUuid", "userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "leads_userUuid_key" ON "leads"("userUuid");

-- CreateIndex
CREATE INDEX "leads_assignedToUuid_idx" ON "leads"("assignedToUuid");

-- CreateIndex
CREATE INDEX "leads_distributorUuid_idx" ON "leads"("distributorUuid");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "lead_activities_leadUuid_idx" ON "lead_activities"("leadUuid");

-- CreateIndex
CREATE INDEX "lead_activities_actorUuid_idx" ON "lead_activities"("actorUuid");

-- CreateIndex
CREATE UNIQUE INDEX "nurture_enrollments_userUuid_key" ON "nurture_enrollments"("userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "nurture_enrollments_leadUuid_key" ON "nurture_enrollments"("leadUuid");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_couponUuid_fkey" FOREIGN KEY ("couponUuid") REFERENCES "coupons"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_uses" ADD CONSTRAINT "coupon_uses_couponUuid_fkey" FOREIGN KEY ("couponUuid") REFERENCES "coupons"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_uses" ADD CONSTRAINT "coupon_uses_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToUuid_fkey" FOREIGN KEY ("assignedToUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadUuid_fkey" FOREIGN KEY ("leadUuid") REFERENCES "leads"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actorUuid_fkey" FOREIGN KEY ("actorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_leadUuid_fkey" FOREIGN KEY ("leadUuid") REFERENCES "leads"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
