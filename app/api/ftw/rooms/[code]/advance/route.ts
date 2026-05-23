import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { advanceRoomNow } from "@/lib/ftw-room-server";

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
  if (room.hostId !== session.user.id) {
    return NextResponse.json({ error: "Only the host can advance." }, { status: 403 });
  }

  const result = await advanceRoomNow(room.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? "Cannot advance." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
