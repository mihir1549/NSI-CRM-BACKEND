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

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ownerUuid_fkey" FOREIGN KEY ("ownerUuid") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
