import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

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
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
      throw err;
    }
    await prisma.ftwRoomPlayer.update({
      where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
      data: { leftAt: null },
    });
  }

  return NextResponse.json({ code: room.code });
}
