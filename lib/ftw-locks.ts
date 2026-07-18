import type { Prisma } from "@prisma/client";

export async function lockFtwMatch(
  tx: Prisma.TransactionClient,
  matchId: string,
  userId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "FtwMatch"
    WHERE "id" = ${matchId}
      AND "userId" = ${userId}
    FOR UPDATE
  `;
  return rows.length === 1;
}

export async function lockFtwRoom(tx: Prisma.TransactionClient, roomId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "FtwRoom"
    WHERE "id" = ${roomId}
    FOR UPDATE
  `;
  return rows.length === 1;
}
