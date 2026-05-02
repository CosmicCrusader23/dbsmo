CREATE TABLE "PracticeSolve" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeSolve_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeSolve_userId_problemId_key" ON "PracticeSolve"("userId", "problemId");
CREATE INDEX "PracticeSolve_userId_idx" ON "PracticeSolve"("userId");
CREATE INDEX "PracticeSolve_problemId_idx" ON "PracticeSolve"("problemId");

ALTER TABLE "PracticeSolve"
ADD CONSTRAINT "PracticeSolve_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeSolve"
ADD CONSTRAINT "PracticeSolve_problemId_fkey"
FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
