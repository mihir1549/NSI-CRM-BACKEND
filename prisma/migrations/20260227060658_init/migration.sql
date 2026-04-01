-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'CUSTOMER', 'DISTRIBUTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('REGISTERED', 'EMAIL_VERIFIED', 'PROFILE_INCOMPLETE', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "uuid" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'REGISTERED',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

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

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUuid_fkey" FOREIGN KEY ("actorUuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
