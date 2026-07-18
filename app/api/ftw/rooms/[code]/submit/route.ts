import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { submitRoomAnswer } from "@/lib/ftw-room-server";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const submitSchema = z.object({
  problemIndex: z.number().int().nonnegative().max(1_000),
  answer: z.string().max(4_000),
});
const MAX_FTW_REQUEST_BYTES = 16_000;

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await readJsonBody(request, { maxBytes: MAX_FTW_REQUEST_BYTES });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const { code } = await params;
  const upper = code.toUpperCase();

  const room = await prisma.ftwRoom.findUnique({ where: { code: upper }, select: { id: true } });
  if (!room) {
    return NextResponse.json({ error: "Room not running." }, { status: 409 });
  }

  const result = await submitRoomAnswer({
    roomId: room.id,
    userId: session.user.id,
    problemIndex: parsed.data.problemIndex,
    rawAnswer: parsed.data.answer,
  });

  if (result.kind === "room-not-running") {
    return NextResponse.json({ error: "Room not running." }, { status: 409 });
  }
  if (result.kind === "not-in-room") {
    return NextResponse.json({ error: "Not in room." }, { status: 403 });
  }
  if (result.kind === "problem-not-found") {
    return NextResponse.json({ error: "Problem not found." }, { status: 404 });
  }
  if (result.kind === "problem-locked") {
    return NextResponse.json({ error: "Problem locked." }, { status: 409 });
  }
  if (result.kind === "already-submitted") {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  return NextResponse.json({ submitted: true });
}
