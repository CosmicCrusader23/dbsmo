import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { startRoom } from "@/lib/ftw-room-server";

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

  const result = await startRoom(room.id, session.user.id);
  if (result.kind === "room-not-found") {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (result.kind === "not-host") {
    return NextResponse.json({ error: "Only host can start." }, { status: 403 });
  }
  if (result.kind === "already-started") {
    return NextResponse.json({ error: "Already started." }, { status: 409 });
  }
  if (result.kind === "no-players") {
    return NextResponse.json({ error: "No players." }, { status: 400 });
  }
  if (result.kind === "no-problems") {
    return NextResponse.json({ error: "No problems available." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
