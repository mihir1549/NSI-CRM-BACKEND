-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('VIDEO_TEXT', 'PHONE_GATE', 'PAYMENT_GATE', 'DECISION');

-- CreateEnum
CREATE TYPE "FunnelProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'DROPPED');

-- CreateTable
CREATE TABLE "funnel_sections" (
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_sections_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "funnel_steps" (
    "uuid" TEXT NOT NULL,
    "sectionUuid" TEXT NOT NULL,
    "type" "StepType" NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_steps_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "step_content" (
    "uuid" TEXT NOT NULL,
    "stepUuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "videoDuration" INTEGER,
    "thumbnailUrl" TEXT,
    "textContent" TEXT,
    "requireVideoCompletion" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_content_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "phone_gate_configs" (
    "uuid" TEXT NOT NULL,
    "stepUuid" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Verify your phone number',
    "subtitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "phone_gate_configs_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "payment_gate_configs" (
    "uuid" TEXT NOT NULL,
    "stepUuid" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Unlock content',
    "subtitle" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "allowCoupons" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_gate_configs_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "decision_step_configs" (
    "uuid" TEXT NOT NULL,
    "stepUuid" TEXT NOT NULL,
    "question" TEXT NOT NULL DEFAULT 'Are you interested in buying a Kangen machine?',
    "yesLabel" TEXT NOT NULL DEFAULT 'Yes, I am interested!',
    "noLabel" TEXT NOT NULL DEFAULT 'Not right now',
    "yesSubtext" TEXT,
    "noSubtext" TEXT,

    CONSTRAINT "decision_step_configs_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "funnel_progress" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "currentSectionUuid" TEXT,
    "currentStepUuid" TEXT,
    "status" "FunnelProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "paymentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "decisionAnswer" TEXT,
    "decisionAnsweredAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_progress_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "step_progress" (
    "uuid" TEXT NOT NULL,
    "funnelProgressUuid" TEXT NOT NULL,
    "stepUuid" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_progress_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "user_acquisitions" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrerUrl" TEXT,
    "landingPage" TEXT,
    "distributorCode" TEXT,
    "distributorUuid" TEXT,
    "ipAddress" TEXT,
    "country" TEXT,
    "city" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_acquisitions_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "funnel_steps_sectionUuid_idx" ON "funnel_steps"("sectionUuid");

-- CreateIndex
CREATE UNIQUE INDEX "step_content_stepUuid_key" ON "step_content"("stepUuid");

-- CreateIndex
CREATE UNIQUE INDEX "phone_gate_configs_stepUuid_key" ON "phone_gate_configs"("stepUuid");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gate_configs_stepUuid_key" ON "payment_gate_configs"("stepUuid");

-- CreateIndex
CREATE UNIQUE INDEX "decision_step_configs_stepUuid_key" ON "decision_step_configs"("stepUuid");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_progress_userUuid_key" ON "funnel_progress"("userUuid");

-- CreateIndex
CREATE INDEX "step_progress_funnelProgressUuid_idx" ON "step_progress"("funnelProgressUuid");

-- CreateIndex
CREATE UNIQUE INDEX "step_progress_funnelProgressUuid_stepUuid_key" ON "step_progress"("funnelProgressUuid", "stepUuid");

-- CreateIndex
CREATE UNIQUE INDEX "user_acquisitions_userUuid_key" ON "user_acquisitions"("userUuid");

-- AddForeignKey
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_sectionUuid_fkey" FOREIGN KEY ("sectionUuid") REFERENCES "funnel_sections"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_content" ADD CONSTRAINT "step_content_stepUuid_fkey" FOREIGN KEY ("stepUuid") REFERENCES "funnel_steps"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_gate_configs" ADD CONSTRAINT "phone_gate_configs_stepUuid_fkey" FOREIGN KEY ("stepUuid") REFERENCES "funnel_steps"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_gate_configs" ADD CONSTRAINT "payment_gate_configs_stepUuid_fkey" FOREIGN KEY ("stepUuid") REFERENCES "funnel_steps"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_step_configs" ADD CONSTRAINT "decision_step_configs_stepUuid_fkey" FOREIGN KEY ("stepUuid") REFERENCES "funnel_steps"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_progress" ADD CONSTRAINT "funnel_progress_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_progress" ADD CONSTRAINT "step_progress_funnelProgressUuid_fkey" FOREIGN KEY ("funnelProgressUuid") REFERENCES "funnel_progress"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_progress" ADD CONSTRAINT "step_progress_stepUuid_fkey" FOREIGN KEY ("stepUuid") REFERENCES "funnel_steps"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_acquisitions" ADD CONSTRAINT "user_acquisitions_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
