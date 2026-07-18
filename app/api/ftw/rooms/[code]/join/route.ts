import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { lockFtwRoom } from "@/lib/ftw-locks";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { code } = await params;
  const upper = code.toUpperCase();
  const room = await prisma.ftwRoom.findUnique({ where: { code: upper }, select: { id: true } });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    if (!(await lockFtwRoom(tx, room.id))) return { kind: "not-found" } as const;
    const current = await tx.ftwRoom.findUnique({ where: { id: room.id } });
    if (!current) return { kind: "not-found" } as const;
    if (current.status === "COMPLETED") return { kind: "completed" } as const;

    const existing = await tx.ftwRoomPlayer.findUnique({
      where: { roomId_userId: { roomId: current.id, userId: session.user.id } },
    });
    if (current.status === "IN_PROGRESS" && !existing) {
      return { kind: "already-started" } as const;
    }

    if (existing) {
      await tx.ftwRoomPlayer.update({
        where: { id: existing.id },
        data: { leftAt: null },
      });
    } else {
      await tx.ftwRoomPlayer.create({
        data: { roomId: current.id, userId: session.user.id },
      });
    }
    return { kind: "joined", code: current.code } as const;
  });

  if (result.kind === "not-found") {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (result.kind === "completed") {
    return NextResponse.json({ error: "Room already finished." }, { status: 409 });
  }
  if (result.kind === "already-started") {
    return NextResponse.json({ error: "Match already started." }, { status: 409 });
  }

  return NextResponse.json({ code: result.code });
}
