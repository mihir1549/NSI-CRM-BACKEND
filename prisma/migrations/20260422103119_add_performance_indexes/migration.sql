-- CreateIndex
CREATE INDEX "leads_status_updatedAt_idx" ON "leads"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "user_acquisitions_capturedAt_idx" ON "user_acquisitions"("capturedAt");

-- CreateIndex
CREATE INDEX "user_acquisitions_distributorUuid_capturedAt_idx" ON "user_acquisitions"("distributorUuid", "capturedAt");
