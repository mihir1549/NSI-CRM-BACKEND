-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'CUSTOMER', 'DISTRIBUTOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('REGISTERED', 'EMAIL_VERIFIED', 'PROFILE_INCOMPLETE', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('VIDEO_TEXT', 'PHONE_GATE', 'PAYMENT_GATE', 'DECISION');

-- CreateEnum
CREATE TYPE "FunnelProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'DROPPED');

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

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "DistributorSubscriptionStatus" AS ENUM ('ACTIVE', 'HALTED', 'CANCELLED', 'EXPIRED', 'GRACE');

-- CreateTable
CREATE TABLE "users" (
    "uuid" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "avatar_url" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'REGISTERED',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "suspended_at" TIMESTAMP(3),
    "suspended_by" TEXT,
    "join_link_active" BOOLEAN NOT NULL DEFAULT true,
    "distributor_code" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "email_otps" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "uuid" TEXT NOT NULL,
    "actorUuid" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("uuid")
);

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
    "bunny_video_id" TEXT,
    "videoDuration" INTEGER,
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
    "badge" TEXT,
    "originalPrice" DECIMAL(65,30),

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
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceUrl" TEXT,
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

-- CreateTable
CREATE TABLE "lead_status_logs" (
    "uuid" TEXT NOT NULL,
    "leadUuid" TEXT NOT NULL,
    "fromStatus" "LeadStatus",
    "toStatus" "LeadStatus" NOT NULL,
    "changedByUuid" TEXT,
    "changedByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_logs_pkey" PRIMARY KEY ("uuid")
);

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
    "tagline" TEXT,
    "features" TEXT[],
    "trustBadges" TEXT[],
    "ctaText" TEXT,
    "highlightBadge" TEXT,
    "testimonials" JSONB NOT NULL DEFAULT '[]',

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
    "migrationPending" BOOLEAN NOT NULL DEFAULT false,
    "planDeactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_subscriptions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "distributor_subscription_history" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "planUuid" TEXT,
    "razorpaySubscriptionId" TEXT,
    "event" TEXT NOT NULL,
    "amount" INTEGER,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_subscription_history_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "courses" (
    "uuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "preview_video_url" TEXT,
    "preview_bunny_video_id" TEXT,
    "badge" TEXT,
    "instructors" TEXT[],
    "what_you_will_learn" TEXT[],
    "original_price" DECIMAL(10,2),
    "total_duration" TEXT,
    "enrollment_boost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "course_sections" (
    "uuid" TEXT NOT NULL,
    "course_uuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "uuid" TEXT NOT NULL,
    "section_uuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "video_url" TEXT,
    "bunny_video_id" TEXT,
    "video_duration" INTEGER,
    "text_content" TEXT,
    "pdf_url" TEXT,
    "order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "attachment_url" TEXT,
    "attachment_name" TEXT,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "course_uuid" TEXT NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "certificate_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "uuid" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "lesson_uuid" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "distributor_tasks" (
    "uuid" TEXT NOT NULL,
    "distributorUuid" TEXT NOT NULL,
    "leadUuid" TEXT,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_tasks_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "distributor_calendar_notes" (
    "uuid" TEXT NOT NULL,
    "distributorUuid" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "time" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_calendar_notes_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "uuid" TEXT NOT NULL,
    "ownerUuid" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "utmSource" TEXT NOT NULL,
    "utmMedium" TEXT NOT NULL,
    "utmCampaign" TEXT NOT NULL,
    "utmContent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "broadcast_messages" (
    "uuid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortMessage" TEXT NOT NULL,
    "fullContent" TEXT,
    "link" TEXT,
    "targetRole" TEXT,
    "targetUuids" TEXT[],
    "createdByUuid" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_messages_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "broadcast_reads" (
    "uuid" TEXT NOT NULL,
    "broadcastUuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_reads_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_distributor_code_key" ON "users"("distributor_code");

-- CreateIndex
CREATE INDEX "auth_sessions_userUuid_idx" ON "auth_sessions"("userUuid");

-- CreateIndex
CREATE INDEX "auth_sessions_tokenId_idx" ON "auth_sessions"("tokenId");

-- CreateIndex
CREATE INDEX "email_otps_userUuid_idx" ON "email_otps"("userUuid");

-- CreateIndex
CREATE INDEX "audit_logs_actorUuid_idx" ON "audit_logs"("actorUuid");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

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

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userUuid_key" ON "user_profiles"("userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_phone_key" ON "user_profiles"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayOrderId_key" ON "payments"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoiceNumber_key" ON "payments"("invoiceNumber");

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

-- CreateIndex
CREATE INDEX "lead_status_logs_leadUuid_idx" ON "lead_status_logs"("leadUuid");

-- CreateIndex
CREATE INDEX "lead_status_logs_changedByUuid_idx" ON "lead_status_logs"("changedByUuid");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_plans_razorpayPlanId_key" ON "distributor_plans"("razorpayPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_subscriptions_userUuid_key" ON "distributor_subscriptions"("userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_subscriptions_razorpaySubscriptionId_key" ON "distributor_subscriptions"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "distributor_subscription_history_userUuid_idx" ON "distributor_subscription_history"("userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_user_uuid_course_uuid_key" ON "course_enrollments"("user_uuid", "course_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_uuid_lesson_uuid_key" ON "lesson_progress"("user_uuid", "lesson_uuid");

-- CreateIndex
CREATE INDEX "distributor_tasks_distributorUuid_idx" ON "distributor_tasks"("distributorUuid");

-- CreateIndex
CREATE INDEX "distributor_calendar_notes_distributorUuid_idx" ON "distributor_calendar_notes"("distributorUuid");

-- CreateIndex
CREATE INDEX "broadcast_messages_createdByUuid_idx" ON "broadcast_messages"("createdByUuid");

-- CreateIndex
CREATE INDEX "broadcast_messages_isActive_idx" ON "broadcast_messages"("isActive");

-- CreateIndex
CREATE INDEX "broadcast_messages_type_idx" ON "broadcast_messages"("type");

-- CreateIndex
CREATE INDEX "broadcast_reads_userUuid_idx" ON "broadcast_reads"("userUuid");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_reads_broadcastUuid_userUuid_key" ON "broadcast_reads"("broadcastUuid", "userUuid");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUuid_fkey" FOREIGN KEY ("actorUuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "lead_status_logs" ADD CONSTRAINT "lead_status_logs_leadUuid_fkey" FOREIGN KEY ("leadUuid") REFERENCES "leads"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_subscriptions" ADD CONSTRAINT "distributor_subscriptions_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_subscriptions" ADD CONSTRAINT "distributor_subscriptions_planUuid_fkey" FOREIGN KEY ("planUuid") REFERENCES "distributor_plans"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_subscription_history" ADD CONSTRAINT "distributor_subscription_history_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_subscription_history" ADD CONSTRAINT "distributor_subscription_history_planUuid_fkey" FOREIGN KEY ("planUuid") REFERENCES "distributor_plans"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_uuid_fkey" FOREIGN KEY ("course_uuid") REFERENCES "courses"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_section_uuid_fkey" FOREIGN KEY ("section_uuid") REFERENCES "course_sections"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_uuid_fkey" FOREIGN KEY ("course_uuid") REFERENCES "courses"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_uuid_fkey" FOREIGN KEY ("lesson_uuid") REFERENCES "course_lessons"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_tasks" ADD CONSTRAINT "distributor_tasks_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_tasks" ADD CONSTRAINT "distributor_tasks_leadUuid_fkey" FOREIGN KEY ("leadUuid") REFERENCES "leads"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_calendar_notes" ADD CONSTRAINT "distributor_calendar_notes_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ownerUuid_fkey" FOREIGN KEY ("ownerUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_reads" ADD CONSTRAINT "broadcast_reads_broadcastUuid_fkey" FOREIGN KEY ("broadcastUuid") REFERENCES "broadcast_messages"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
