import type { Prisma } from "@prisma/client";

/** Serialize destructive or file-linking mutations for one problem set. */
export async function lockProblemSet(
  tx: Prisma.TransactionClient,
  problemSetId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "ProblemSet"
    WHERE "id" = ${problemSetId}
    FOR UPDATE
  `;
  return rows.length === 1;
}
