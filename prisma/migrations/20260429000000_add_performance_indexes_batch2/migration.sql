-- CreateIndex
CREATE INDEX "funnel_progress_paymentCompleted_updatedAt_idx" ON "funnel_progress"("paymentCompleted", "updatedAt");

-- CreateIndex
CREATE INDEX "lead_activities_action_followupAt_idx" ON "lead_activities"("action", "followupAt");

-- CreateIndex
CREATE INDEX "leads_assignedToUuid_status_idx" ON "leads"("assignedToUuid", "status");

-- CreateIndex
CREATE INDEX "nurture_enrollments_status_nextEmailAt_idx" ON "nurture_enrollments"("status", "nextEmailAt");

-- CreateIndex
CREATE INDEX "user_profiles_phoneVerifiedAt_idx" ON "user_profiles"("phoneVerifiedAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_role_createdAt_idx" ON "users"("role", "createdAt");

-- CreateIndex
CREATE INDEX "users_emailVerified_createdAt_idx" ON "users"("emailVerified", "createdAt");
