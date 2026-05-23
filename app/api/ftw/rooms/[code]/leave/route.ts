import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { advanceRoomIfDue } from "@/lib/ftw-room-server";

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

  await prisma.ftwRoomPlayer.updateMany({
    where: { roomId: room.id, userId: session.user.id, leftAt: null },
    data: { leftAt: new Date() },
  });

  if (room.status === "IN_PROGRESS") {
    await advanceRoomIfDue(room.id);
  }

  return NextResponse.json({ ok: true });
}
