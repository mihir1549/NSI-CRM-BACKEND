/*
  Warnings:

  - A unique constraint covering the columns `[distributor_code]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "distributor_code" TEXT,
ADD COLUMN     "join_link_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspended_by" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_distributor_code_key" ON "users"("distributor_code");
