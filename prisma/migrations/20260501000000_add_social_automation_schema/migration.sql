-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('PENDING', 'APPROVED', 'POSTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SocialPostType" AS ENUM ('HEALTH', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "MetaLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MessageTemplateType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'PDF');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SSE');

-- CreateEnum
CREATE TYPE "CommentTriggerMode" AS ENUM ('ALL_COMMENTS', 'KEYWORDS_ONLY');

-- CreateTable
CREATE TABLE "SocialConfig" (
    "uuid" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SocialConfig_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "SocialLanguage" (
    "uuid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialLanguage_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "SocialTopic" (
    "uuid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "geminiPromptHint" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialTopic_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "SocialPreference" (
    "uuid" TEXT NOT NULL,
    "distributorUuid" TEXT NOT NULL,
    "selectedLanguages" TEXT[],
    "selectedTopics" TEXT[],
    "autoPostEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoDmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoWhatsApp" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnSources" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPreference_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "uuid" TEXT NOT NULL,
    "distributorUuid" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "pageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "uuid" TEXT NOT NULL,
    "distributorUuid" TEXT NOT NULL,
    "type" "SocialPostType" NOT NULL,
    "languageCode" TEXT NOT NULL,
    "topicCode" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[],
    "imageUrl" TEXT,
    "imagePrompt" TEXT NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'PENDING',
    "platforms" "SocialPlatform"[],
    "scheduledAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "metaPostIds" JSONB,
    "generatedFor" TIMESTAMP(3) NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "CommentDmSetting" (
    "uuid" TEXT NOT NULL,
    "distributorUuid" TEXT NOT NULL,
    "triggerMode" "CommentTriggerMode" NOT NULL DEFAULT 'KEYWORDS_ONLY',
    "keywords" TEXT[],
    "dmDelayMinutes" INTEGER NOT NULL DEFAULT 2,
    "dmTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentDmSetting_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MetaLead" (
    "uuid" TEXT NOT NULL,
    "distributorUuid" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "referralCode" TEXT,
    "metaFormId" TEXT,
    "metaLeadgenId" TEXT,
    "status" "MetaLeadStatus" NOT NULL DEFAULT 'NEW',
    "userUuid" TEXT,
    "whatsappSentAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaLead_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MessageTemplateType" NOT NULL,
    "content" TEXT,
    "mediaUrl" TEXT,
    "caption" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "OnboardingSequence" (
    "uuid" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "templateUuid" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingSequence_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "OnboardingQueue" (
    "uuid" TEXT NOT NULL,
    "distributorUuid" TEXT NOT NULL,
    "sequenceUuid" TEXT NOT NULL,
    "templateUuid" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingQueue_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "FollowupSequence" (
    "uuid" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "templateUuid" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowupSequence_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "FollowupQueue" (
    "uuid" TEXT NOT NULL,
    "leadUuid" TEXT NOT NULL,
    "leadType" TEXT NOT NULL,
    "sequenceUuid" TEXT NOT NULL,
    "templateUuid" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowupQueue_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "DropoffSequence" (
    "uuid" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "templateUuid" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DropoffSequence_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "DropoffQueue" (
    "uuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "sequenceUuid" TEXT NOT NULL,
    "templateUuid" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropoffQueue_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialConfig_key_key" ON "SocialConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SocialLanguage_code_key" ON "SocialLanguage"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SocialTopic_code_key" ON "SocialTopic"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPreference_distributorUuid_key" ON "SocialPreference"("distributorUuid");

-- CreateIndex
CREATE INDEX "SocialPreference_distributorUuid_idx" ON "SocialPreference"("distributorUuid");

-- CreateIndex
CREATE INDEX "SocialAccount_distributorUuid_idx" ON "SocialAccount"("distributorUuid");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_distributorUuid_platform_key" ON "SocialAccount"("distributorUuid", "platform");

-- CreateIndex
CREATE INDEX "SocialPost_distributorUuid_generatedFor_idx" ON "SocialPost"("distributorUuid", "generatedFor");

-- CreateIndex
CREATE INDEX "SocialPost_status_scheduledAt_idx" ON "SocialPost"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "SocialPost_distributorUuid_status_idx" ON "SocialPost"("distributorUuid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommentDmSetting_distributorUuid_key" ON "CommentDmSetting"("distributorUuid");

-- CreateIndex
CREATE UNIQUE INDEX "MetaLead_metaLeadgenId_key" ON "MetaLead"("metaLeadgenId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaLead_userUuid_key" ON "MetaLead"("userUuid");

-- CreateIndex
CREATE INDEX "MetaLead_distributorUuid_status_idx" ON "MetaLead"("distributorUuid", "status");

-- CreateIndex
CREATE INDEX "MetaLead_phone_idx" ON "MetaLead"("phone");

-- CreateIndex
CREATE INDEX "MetaLead_createdAt_idx" ON "MetaLead"("createdAt");

-- CreateIndex
CREATE INDEX "OnboardingQueue_sendAt_status_idx" ON "OnboardingQueue"("sendAt", "status");

-- CreateIndex
CREATE INDEX "OnboardingQueue_distributorUuid_idx" ON "OnboardingQueue"("distributorUuid");

-- CreateIndex
CREATE INDEX "FollowupQueue_sendAt_status_idx" ON "FollowupQueue"("sendAt", "status");

-- CreateIndex
CREATE INDEX "FollowupQueue_leadUuid_idx" ON "FollowupQueue"("leadUuid");

-- CreateIndex
CREATE INDEX "DropoffQueue_sendAt_status_idx" ON "DropoffQueue"("sendAt", "status");

-- CreateIndex
CREATE INDEX "DropoffQueue_userUuid_idx" ON "DropoffQueue"("userUuid");

-- AddForeignKey
ALTER TABLE "SocialPreference" ADD CONSTRAINT "SocialPreference_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentDmSetting" ADD CONSTRAINT "CommentDmSetting_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaLead" ADD CONSTRAINT "MetaLead_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaLead" ADD CONSTRAINT "MetaLead_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingSequence" ADD CONSTRAINT "OnboardingSequence_templateUuid_fkey" FOREIGN KEY ("templateUuid") REFERENCES "MessageTemplate"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingQueue" ADD CONSTRAINT "OnboardingQueue_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingQueue" ADD CONSTRAINT "OnboardingQueue_sequenceUuid_fkey" FOREIGN KEY ("sequenceUuid") REFERENCES "OnboardingSequence"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupSequence" ADD CONSTRAINT "FollowupSequence_templateUuid_fkey" FOREIGN KEY ("templateUuid") REFERENCES "MessageTemplate"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupQueue" ADD CONSTRAINT "FollowupQueue_sequenceUuid_fkey" FOREIGN KEY ("sequenceUuid") REFERENCES "FollowupSequence"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropoffSequence" ADD CONSTRAINT "DropoffSequence_templateUuid_fkey" FOREIGN KEY ("templateUuid") REFERENCES "MessageTemplate"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropoffQueue" ADD CONSTRAINT "DropoffQueue_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropoffQueue" ADD CONSTRAINT "DropoffQueue_sequenceUuid_fkey" FOREIGN KEY ("sequenceUuid") REFERENCES "DropoffSequence"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
