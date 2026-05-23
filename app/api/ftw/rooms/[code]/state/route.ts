import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { advanceRoomIfDue } from "@/lib/ftw-room-server";
import { maxRoomScorePerProblem } from "@/lib/ftw-room";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { code } = await params;
  const upper = code.toUpperCase();

  const initial = await prisma.ftwRoom.findUnique({ where: { code: upper } });
  if (!initial) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  if (initial.status === "IN_PROGRESS") {
    await advanceRoomIfDue(initial.id);
  }

  const room = await prisma.ftwRoom.findUnique({
    where: { code: upper },
    include: {
      host: { select: { id: true, displayName: true, name: true } },
      players: {
        where: { leftAt: null },
        orderBy: { joinedAt: "asc" },
        include: {
          user: { select: { id: true, displayName: true, name: true } },
        },
      },
      problems: {
        orderBy: { problemIndex: "desc" },
        take: 1,
        include: {
          problem: {
            select: { id: true, statement: true, contentFormat: true },
          },
          answers: {
            select: {
              playerId: true,
              userId: true,
              submittedAt: true,
              isCorrect: true,
              points: true,
            },
          },
        },
      },
    },
  });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const me = room.players.find((p) => p.userId === session.user.id);
  const isMember = me !== undefined || room.hostId === session.user.id;
  if (!isMember && room.status !== "LOBBY") {
    return NextResponse.json({ error: "Not a member of this room." }, { status: 403 });
  }

  const current = room.problems[0];
  const myAnswer = current
    ? current.answers.find((a) => a.userId === session.user.id) ?? null
    : null;

  const showStatement = room.status === "IN_PROGRESS" && current && !current.lockedAt;
  const playerAnsweredIds = new Set(current?.answers.map((a) => a.playerId) ?? []);

  return NextResponse.json({
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    isHost: room.hostId === session.user.id,
    tag: room.tag,
    totalProblems: room.totalProblems,
    problemLimitMs: room.problemLimitMs,
    maxScorePerProblem: maxRoomScorePerProblem(),
    currentIndex: room.currentIndex,
    players: room.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.displayName ?? p.user.name ?? "Player",
      score: p.score,
      hasAnsweredCurrent: playerAnsweredIds.has(p.id),
      isYou: p.userId === session.user.id,
    })),
    current: current
      ? {
          problemIndex: current.problemIndex,
          endsAt: current.endsAt,
          locked: Boolean(current.lockedAt),
          remainingMs: Math.max(0, current.endsAt.getTime() - Date.now()),
          problem: showStatement
            ? {
                id: current.problem.id,
                statement: current.problem.statement,
                contentFormat: current.problem.contentFormat,
              }
            : null,
          revealedAnswers: current.lockedAt
            ? current.answers.map((a) => ({
                userId: a.userId,
                submittedAt: a.submittedAt,
                isCorrect: a.isCorrect,
                points: a.points,
              }))
            : null,
          myAnswer: myAnswer
            ? {
                submitted: Boolean(myAnswer.submittedAt),
                isCorrect: myAnswer.isCorrect,
                points: myAnswer.points,
              }
            : null,
        }
      : null,
    completedAt: room.completedAt,
  });
}
