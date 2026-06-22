import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { code } = await params;
  const upper = code.toUpperCase();
  const room = await prisma.ftwRoom.findUnique({ where: { code: upper } });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status === "COMPLETED") {
    return NextResponse.json({ error: "Room already finished." }, { status: 409 });
  }
  if (room.status === "IN_PROGRESS") {
    const existing = await prisma.ftwRoomPlayer.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Match already started." }, { status: 409 });
    }
  }

  try {
    await prisma.ftwRoomPlayer.create({
      data: { roomId: room.id, userId: session.user.id },
    });
  } catch (err) {
    if (!isPrismaUniqueViolation(err)) {
      throw err;
    }
    await prisma.ftwRoomPlayer.update({
      where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
      data: { leftAt: null },
    });
  }

  return NextResponse.json({ code: room.code });
}
