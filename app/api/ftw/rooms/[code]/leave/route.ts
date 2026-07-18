import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { advanceRoomIfDue } from "@/lib/ftw-room-server";
import { decideHostTransition } from "@/lib/ftw-room-host";
import { lockFtwRoom } from "@/lib/ftw-locks";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { code } = await params;
  const room = await prisma.ftwRoom.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true },
  });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const userId = session.user.id;
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    if (!(await lockFtwRoom(tx, room.id))) return { kind: "not-found" } as const;
    const current = await tx.ftwRoom.findUnique({ where: { id: room.id } });
    if (!current) return { kind: "not-found" } as const;

    await tx.ftwRoomPlayer.updateMany({
      where: { roomId: current.id, userId, leftAt: null },
      data: { leftAt: now },
    });

    const remainingPlayers = await tx.ftwRoomPlayer.findMany({
      where: { roomId: current.id, leftAt: null, userId: { not: userId } },
      select: { userId: true, joinedAt: true },
      orderBy: { joinedAt: "asc" },
    });

    const transition = decideHostTransition({
      leavingUserId: userId,
      currentHostId: current.hostId,
      status: current.status,
      remainingActivePlayers: remainingPlayers,
    });

    if (transition.kind === "close") {
      await tx.ftwRoom.update({
        where: { id: current.id },
        data: { status: "COMPLETED", completedAt: now },
      });
    } else if (transition.kind === "transfer") {
      await tx.ftwRoom.update({
        where: { id: current.id },
        data: { hostId: transition.newHostId },
      });
    }

    return { kind: "left", transition, previousStatus: current.status } as const;
  });

  if (result.kind === "not-found") {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (result.transition.kind !== "close" && result.previousStatus === "IN_PROGRESS") {
    await advanceRoomIfDue(room.id);
  }

  return NextResponse.json({ ok: true, transition: result.transition.kind });
}
