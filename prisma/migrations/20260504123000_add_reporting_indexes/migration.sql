CREATE INDEX IF NOT EXISTS "Attempt_userId_idx" ON "Attempt"("userId");
CREATE INDEX IF NOT EXISTS "Attempt_problemSetId_idx" ON "Attempt"("problemSetId");
CREATE INDEX IF NOT EXISTS "Attempt_submittedAt_idx" ON "Attempt"("submittedAt");

CREATE INDEX IF NOT EXISTS "Response_problemId_idx" ON "Response"("problemId");

CREATE INDEX IF NOT EXISTS "FeedbackReport_status_createdAt_idx" ON "FeedbackReport"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "FeedbackReport_problemSetId_idx" ON "FeedbackReport"("problemSetId");
