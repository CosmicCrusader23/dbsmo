import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { pickNextRoomProblem } from "@/lib/ftw-room-server";

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
  const room = await prisma.ftwRoom.findUnique({
    where: { code: code.toUpperCase() },
    include: { players: true },
  });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.hostId !== session.user.id) {
    return NextResponse.json({ error: "Only host can start." }, { status: 403 });
  }
  if (room.status !== "LOBBY") {
    return NextResponse.json({ error: "Already started." }, { status: 409 });
  }
  if (room.players.length === 0) {
    return NextResponse.json({ error: "No players." }, { status: 400 });
  }

  await prisma.ftwRoom.update({
    where: { id: room.id },
    data: { status: "IN_PROGRESS", startedAt: new Date(), currentIndex: -1 },
  });

  const next = await pickNextRoomProblem(room.id);
  if (!next) {
    await prisma.ftwRoom.update({
      where: { id: room.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return NextResponse.json({ error: "No problems available." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
