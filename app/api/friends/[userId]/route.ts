import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  try {
    const existing = await friendshipDelegate.findUnique({
      where: { requesterId_receiverId: { requesterId, receiverId } },
    });

    if (existing) {
      await friendshipDelegate.delete({ where: { id: existing.id } });
      return NextResponse.json({ ok: true, isFriend: false });
    }

    await friendshipDelegate.create({
      data: { requesterId, receiverId },
    });

    return NextResponse.json({ ok: true, isFriend: true });
  } catch {
    return NextResponse.json({ error: "Friend data is not ready yet." }, { status: 503 });
  }
}
