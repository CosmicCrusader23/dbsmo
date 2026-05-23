import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { type AnswerType, gradeAnswer } from "@/lib/grading";
import { roomScore } from "@/lib/ftw-room";
import { advanceRoomIfDue } from "@/lib/ftw-room-server";

export const runtime = "nodejs";

const submitSchema = z.object({
  problemIndex: z.number().int().nonnegative(),
  answer: z.string(),
});

const ANSWER_TYPE_MAP = {
  EXACT: "exact",
  INTEGER: "integer",
  DECIMAL: "decimal",
  FRACTION: "fraction",
  SET: "set",
  MULTIPLE: "multiple",
  EXPRESSION: "expression",
} as const satisfies Record<string, AnswerType>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const { code } = await params;
  const upper = code.toUpperCase();

  const room = await prisma.ftwRoom.findUnique({
    where: { code: upper },
    include: {
      players: { where: { userId: session.user.id, leftAt: null } },
    },
  });
  if (!room || room.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Room not running." }, { status: 409 });
  }
  const player = room.players[0];
  if (!player) {
    return NextResponse.json({ error: "Not in room." }, { status: 403 });
  }

  const roomProblem = await prisma.ftwRoomProblem.findUnique({
    where: { roomId_problemIndex: { roomId: room.id, problemIndex: parsed.data.problemIndex } },
    include: { problem: true },
  });
  if (!roomProblem) {
    return NextResponse.json({ error: "Problem not found." }, { status: 404 });
  }
  if (roomProblem.lockedAt) {
    return NextResponse.json({ error: "Problem locked." }, { status: 409 });
  }

  const now = Date.now();
  const elapsedMs = now - roomProblem.servedAt.getTime();
  const timedOut = now >= roomProblem.endsAt.getTime();

  const { isCorrect } = timedOut
    ? { isCorrect: false }
    : gradeAnswer({
        rawAnswer: parsed.data.answer,
        answerType: ANSWER_TYPE_MAP[roomProblem.problem.answerType],
        answerKey: roomProblem.problem.answerKey,
        acceptedAnswers: roomProblem.problem.acceptedAnswers,
        caseSensitive: roomProblem.problem.caseSensitive,
      });

  const points = timedOut ? 0 : roomScore(elapsedMs, room.problemLimitMs, isCorrect);

  try {
    await prisma.$transaction([
      prisma.ftwRoomAnswer.create({
        data: {
          roomProblemId: roomProblem.id,
          playerId: player.id,
          userId: session.user.id,
          rawAnswer: parsed.data.answer,
          submittedAt: new Date(now),
          elapsedMs,
          isCorrect: timedOut ? false : isCorrect,
          points,
        },
      }),
      prisma.ftwRoomPlayer.update({
        where: { id: player.id },
        data: { score: { increment: points } },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Already submitted." }, { status: 409 });
    }
    throw err;
  }

  await advanceRoomIfDue(room.id);

  return NextResponse.json({
    isCorrect: timedOut ? false : isCorrect,
    points,
    elapsedMs,
    timedOut,
  });
}
