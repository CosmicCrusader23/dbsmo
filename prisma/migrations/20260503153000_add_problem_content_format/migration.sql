CREATE TYPE "ProblemContentFormat" AS ENUM ('LATEX', 'HTML');

ALTER TABLE "Problem"
ADD COLUMN "contentFormat" "ProblemContentFormat" NOT NULL DEFAULT 'LATEX';
