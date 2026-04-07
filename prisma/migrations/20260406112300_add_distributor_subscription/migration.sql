-- CreateEnum
CREATE TYPE "DistributorSubscriptionStatus" AS ENUM ('ACTIVE', 'HALTED', 'CANCELLED', 'EXPIRED', 'GRACE');

-- CreateTable
CREATE TABLE "distributor_plans" (
    "uuid" TEXT NOT NULL,
    "razorpayPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_plans_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "distributor_subscriptions" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "planUuid" TEXT NOT NULL,
    "razorpaySubscriptionId" TEXT NOT NULL,
    "status" "DistributorSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "graceDeadline" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_subscriptions_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "distributor_plans_razorpayPlanId_key" ON "distributor_plans"("razorpayPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_subscriptions_userUuid_key" ON "distributor_subscriptions"("userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_subscriptions_razorpaySubscriptionId_key" ON "distributor_subscriptions"("razorpaySubscriptionId");

-- AddForeignKey
ALTER TABLE "distributor_subscriptions" ADD CONSTRAINT "distributor_subscriptions_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_subscriptions" ADD CONSTRAINT "distributor_subscriptions_planUuid_fkey" FOREIGN KEY ("planUuid") REFERENCES "distributor_plans"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
