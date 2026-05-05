ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TEACHER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CONTENT_EDITOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ANALYST';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExportJobStatus') THEN
    CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExportJobType') THEN
    CREATE TYPE "ExportJobType" AS ENUM ('ATTEMPTS_CSV', 'STUDENTS_CSV', 'BACKUP_JSON');
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "leaderboardVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_actorId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ExportJob" (
  "id" TEXT NOT NULL,
  "type" "ExportJobType" NOT NULL,
  "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "payload" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExportJob_requestedById_createdAt_idx" ON "ExportJob"("requestedById", "createdAt");
CREATE INDEX IF NOT EXISTS "ExportJob_status_createdAt_idx" ON "ExportJob"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ExportJob_requestedById_fkey'
  ) THEN
    ALTER TABLE "ExportJob"
    ADD CONSTRAINT "ExportJob_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

WITH mapped AS (
  SELECT
    ps."id",
    CASE regexp_replace(lower(trim(tag)), '[-_]+', ' ', 'g')
      WHEN 'sequence' THEN 'Series'
      WHEN 'series' THEN 'Series'
      WHEN 'trig' THEN 'Trigonometry'
      WHEN 'trigonometry' THEN 'Trigonometry'
      WHEN 'geo' THEN 'Geometry'
      WHEN 'geometry' THEN 'Geometry'
      WHEN 'coordinate geometry' THEN 'Cogeom'
      WHEN 'coord geom' THEN 'Cogeom'
      WHEN 'co geo' THEN 'Cogeom'
      WHEN 'cogeom' THEN 'Cogeom'
      WHEN 'alg' THEN 'Algebra'
      WHEN 'algebra' THEN 'Algebra'
      WHEN 'number theory' THEN 'Number Theory'
      WHEN 'nt' THEN 'Number Theory'
      WHEN 'combo' THEN 'Combinatorics'
      WHEN 'combi' THEN 'Combinatorics'
      WHEN 'combinatorics' THEN 'Combinatorics'
      WHEN 'aime' THEN 'AIME'
      WHEN 'amc' THEN 'AMC'
      WHEN 'ajhsme' THEN 'AJHSME'
      ELSE initcap(regexp_replace(trim(tag), '[-_]+', ' ', 'g'))
    END AS tag,
    ord
  FROM "ProblemSet" ps, unnest(ps."topicTags") WITH ORDINALITY AS tags(tag, ord)
),
deduped AS (
  SELECT "id", tag, min(ord) AS ord FROM mapped WHERE tag <> '' GROUP BY "id", tag
),
rebuilt AS (
  SELECT "id", array_agg(tag ORDER BY ord) AS tags FROM deduped GROUP BY "id"
)
UPDATE "ProblemSet" ps SET "topicTags" = rebuilt.tags FROM rebuilt WHERE rebuilt."id" = ps."id";

WITH mapped AS (
  SELECT
    p."id",
    CASE regexp_replace(lower(trim(tag)), '[-_]+', ' ', 'g')
      WHEN 'sequence' THEN 'Series'
      WHEN 'series' THEN 'Series'
      WHEN 'trig' THEN 'Trigonometry'
      WHEN 'trigonometry' THEN 'Trigonometry'
      WHEN 'geo' THEN 'Geometry'
      WHEN 'geometry' THEN 'Geometry'
      WHEN 'coordinate geometry' THEN 'Cogeom'
      WHEN 'coord geom' THEN 'Cogeom'
      WHEN 'co geo' THEN 'Cogeom'
      WHEN 'cogeom' THEN 'Cogeom'
      WHEN 'alg' THEN 'Algebra'
      WHEN 'algebra' THEN 'Algebra'
      WHEN 'number theory' THEN 'Number Theory'
      WHEN 'nt' THEN 'Number Theory'
      WHEN 'combo' THEN 'Combinatorics'
      WHEN 'combi' THEN 'Combinatorics'
      WHEN 'combinatorics' THEN 'Combinatorics'
      WHEN 'aime' THEN 'AIME'
      WHEN 'amc' THEN 'AMC'
      WHEN 'ajhsme' THEN 'AJHSME'
      ELSE initcap(regexp_replace(trim(tag), '[-_]+', ' ', 'g'))
    END AS tag,
    ord
  FROM "Problem" p, unnest(p."topicTags") WITH ORDINALITY AS tags(tag, ord)
),
deduped AS (
  SELECT "id", tag, min(ord) AS ord FROM mapped WHERE tag <> '' GROUP BY "id", tag
),
rebuilt AS (
  SELECT "id", array_agg(tag ORDER BY ord) AS tags FROM deduped GROUP BY "id"
)
UPDATE "Problem" p SET "topicTags" = rebuilt.tags FROM rebuilt WHERE rebuilt."id" = p."id";
