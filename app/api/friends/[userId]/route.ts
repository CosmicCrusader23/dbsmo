import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPrismaKnownError, isRetryablePrismaTransactionError } from "@/lib/prisma-errors";

const MAX_TOGGLE_ATTEMPTS = 3;

type RouteContext = {
  params: Promise<{ userId: string }>;
};

function friendshipPair(userA: string, userB: string) {
  return [userA, userB].sort() as [string, string];
}

export async function PATCH(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!userId || userId === session.user.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const friendshipDelegate = prisma.friendship;
  if (!friendshipDelegate) {
    return NextResponse.json({ error: "Friend data is not ready yet." }, { status: 503 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [requesterId, receiverId] = friendshipPair(session.user.id, targetUser.id);
  for (let attempt = 1; attempt <= MAX_TOGGLE_ATTEMPTS; attempt += 1) {
    try {
      const isFriend = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.friendship.findUnique({
            where: { requesterId_receiverId: { requesterId, receiverId } },
          });

          if (existing) {
            await tx.friendship.delete({ where: { id: existing.id } });
            return false;
          }

          await tx.friendship.create({
            data: { requesterId, receiverId },
          });
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return NextResponse.json({ ok: true, isFriend });
    } catch (error) {
      const raced = isRetryablePrismaTransactionError(error) || isPrismaKnownError(error, "P2025");
      if (raced && attempt < MAX_TOGGLE_ATTEMPTS) {
        continue;
      }
      if (raced) {
        return NextResponse.json(
          { error: "Friend status changed at the same time. Please retry." },
          { status: 409 },
        );
      }
      if (isPrismaKnownError(error, "P2003")) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (isPrismaKnownError(error, "P2021")) {
        return NextResponse.json({ error: "Friend data is not ready yet." }, { status: 503 });
      }
      console.error("Failed to toggle friendship:", error);
      return NextResponse.json({ error: "Could not update friend status." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not update friend status." }, { status: 500 });
}
