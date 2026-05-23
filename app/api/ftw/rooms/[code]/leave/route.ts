import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { advanceRoomIfDue } from "@/lib/ftw-room-server";
import { decideHostTransition } from "@/lib/ftw-room-host";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { code } = await params;
  const room = await prisma.ftwRoom.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const userId = session.user.id;
  const now = new Date();

  await prisma.ftwRoomPlayer.updateMany({
    where: { roomId: room.id, userId, leftAt: null },
    data: { leftAt: now },
  });

  const remainingPlayers = await prisma.ftwRoomPlayer.findMany({
    where: { roomId: room.id, leftAt: null, userId: { not: userId } },
    select: { userId: true, joinedAt: true },
    orderBy: { joinedAt: "asc" },
  });

  const transition = decideHostTransition({
    leavingUserId: userId,
    currentHostId: room.hostId,
    status: room.status,
    remainingActivePlayers: remainingPlayers,
  });

  if (transition.kind === "close") {
    await prisma.ftwRoom.update({
      where: { id: room.id },
      data: { status: "COMPLETED", completedAt: now },
    });
  } else if (transition.kind === "transfer") {
    await prisma.ftwRoom.update({
      where: { id: room.id },
      data: { hostId: transition.newHostId },
    });
  }

  if (transition.kind !== "close" && room.status === "IN_PROGRESS") {
    await advanceRoomIfDue(room.id);
  }

  return NextResponse.json({ ok: true, transition: transition.kind });
}
