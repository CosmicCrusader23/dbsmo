CREATE TABLE IF NOT EXISTS "Writeup" (
  "id" TEXT NOT NULL,
  "problemSetId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "contentFormat" "ProblemContentFormat" NOT NULL DEFAULT 'LATEX',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Writeup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WriteupImage" (
  "id" TEXT NOT NULL,
  "writeupId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WriteupImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WriteupVote" (
  "id" TEXT NOT NULL,
  "writeupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WriteupVote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Writeup_problemSetId_createdAt_idx" ON "Writeup"("problemSetId", "createdAt");
CREATE INDEX IF NOT EXISTS "Writeup_authorId_createdAt_idx" ON "Writeup"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "WriteupImage_writeupId_sortOrder_idx" ON "WriteupImage"("writeupId", "sortOrder");
CREATE INDEX IF NOT EXISTS "WriteupImage_fileId_idx" ON "WriteupImage"("fileId");
CREATE UNIQUE INDEX IF NOT EXISTS "WriteupVote_writeupId_userId_key" ON "WriteupVote"("writeupId", "userId");
CREATE INDEX IF NOT EXISTS "WriteupVote_userId_idx" ON "WriteupVote"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Writeup_problemSetId_fkey') THEN
    ALTER TABLE "Writeup"
    ADD CONSTRAINT "Writeup_problemSetId_fkey"
    FOREIGN KEY ("problemSetId") REFERENCES "ProblemSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Writeup_authorId_fkey') THEN
    ALTER TABLE "Writeup"
    ADD CONSTRAINT "Writeup_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WriteupImage_writeupId_fkey') THEN
    ALTER TABLE "WriteupImage"
    ADD CONSTRAINT "WriteupImage_writeupId_fkey"
    FOREIGN KEY ("writeupId") REFERENCES "Writeup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WriteupImage_fileId_fkey') THEN
    ALTER TABLE "WriteupImage"
    ADD CONSTRAINT "WriteupImage_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "ImportedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WriteupVote_writeupId_fkey') THEN
    ALTER TABLE "WriteupVote"
    ADD CONSTRAINT "WriteupVote_writeupId_fkey"
    FOREIGN KEY ("writeupId") REFERENCES "Writeup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WriteupVote_userId_fkey') THEN
    ALTER TABLE "WriteupVote"
    ADD CONSTRAINT "WriteupVote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WriteupVote_value_check') THEN
    ALTER TABLE "WriteupVote"
    ADD CONSTRAINT "WriteupVote_value_check" CHECK ("value" IN (-1, 1));
  END IF;
END $$;
