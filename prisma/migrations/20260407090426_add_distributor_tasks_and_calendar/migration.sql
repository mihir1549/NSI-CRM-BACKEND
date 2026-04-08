-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETE');

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_calendar_notes_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "distributor_tasks_distributorUuid_idx" ON "distributor_tasks"("distributorUuid");

-- CreateIndex
CREATE INDEX "distributor_calendar_notes_distributorUuid_idx" ON "distributor_calendar_notes"("distributorUuid");

-- AddForeignKey
ALTER TABLE "distributor_tasks" ADD CONSTRAINT "distributor_tasks_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_tasks" ADD CONSTRAINT "distributor_tasks_leadUuid_fkey" FOREIGN KEY ("leadUuid") REFERENCES "leads"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_calendar_notes" ADD CONSTRAINT "distributor_calendar_notes_distributorUuid_fkey" FOREIGN KEY ("distributorUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
