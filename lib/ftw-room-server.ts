import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { lockFtwRoom } from "@/lib/ftw-locks";
import { roomScore } from "@/lib/ftw-room";
import { decideRoomAdvance } from "@/lib/ftw-room-transition";
import { type AnswerType, gradeAnswer } from "@/lib/grading";

type FtwTransaction = Prisma.TransactionClient;

const ANSWER_TYPE_MAP = {
  EXACT: "exact",
  INTEGER: "integer",
  DECIMAL: "decimal",
  FRACTION: "fraction",
  SET: "set",
  MULTIPLE: "multiple",
  EXPRESSION: "expression",
} as const satisfies Record<string, AnswerType>;

async function pickNextRoomProblemLocked(
  tx: FtwTransaction,
  roomId: string,
): Promise<{
  roomProblemId: string;
  problemIndex: number;
  endsAt: Date;
} | null> {
  const room = await tx.ftwRoom.findUnique({
    where: { id: roomId },
    include: { problems: { select: { problemId: true } } },
  });
  if (!room) return null;
  const used = room.problems.map((problem) => problem.problemId);

  const now = new Date();
  const candidateWhere = {
    id: { notIn: used },
    problemSet: {
      status: "PUBLISHED" as const,
      AND: [
        { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
        { OR: [{ visibleTo: null }, { visibleTo: { gte: now } }] },
      ],
    },
    ...(room.tag ? { topicTags: { has: room.tag } } : {}),
  };
  const candidateCount = await tx.problem.count({ where: candidateWhere });
  if (candidateCount === 0) return null;
  const picked =
    (await tx.problem.findFirst({
      where: candidateWhere,
      orderBy: { id: "asc" },
      skip: Math.floor(Math.random() * candidateCount),
      select: { id: true },
    })) ??
    (await tx.problem.findFirst({
      where: candidateWhere,
      orderBy: { id: "asc" },
      select: { id: true },
    }));
  if (!picked) return null;
  const nextIndex = room.currentIndex + 1;
  const endsAt = new Date(now.getTime() + room.problemLimitMs);

  const created = await tx.ftwRoomProblem.create({
    data: {
      roomId,
      problemId: picked.id,
      problemIndex: nextIndex,
      servedAt: now,
      endsAt,
    },
  });
  await tx.ftwRoom.update({
    where: { id: roomId },
    data: { currentIndex: nextIndex },
  });
  return { roomProblemId: created.id, problemIndex: nextIndex, endsAt };
}

export async function pickNextRoomProblem(roomId: string): Promise<{
  roomProblemId: string;
  problemIndex: number;
  endsAt: Date;
} | null> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockFtwRoom(tx, roomId))) return null;
    return pickNextRoomProblemLocked(tx, roomId);
  });
}

async function advanceRoomIfDueLocked(tx: FtwTransaction, roomId: string): Promise<void> {
  const room = await tx.ftwRoom.findUnique({
    where: { id: roomId },
    include: {
      players: { where: { leftAt: null }, select: { id: true } },
      problems: {
        orderBy: { problemIndex: "desc" },
        take: 1,
        include: { answers: { select: { playerId: true, points: true } } },
      },
    },
  });
  if (!room) return;

  const current = room.problems[0];
  const activePlayerIds = room.players.map((player) => player.id);
  const answeredPlayerIds = new Set(current?.answers.map((answer) => answer.playerId) ?? []);
  const decision = decideRoomAdvance({
    status: room.status,
    hasCurrent: current !== undefined,
    currentLocked: Boolean(current?.lockedAt),
    currentTimedOut: current !== undefined && Date.now() >= current.endsAt.getTime(),
    activePlayerIds,
    answeredPlayerIds,
    currentIndex: room.currentIndex,
    totalProblems: room.totalProblems,
  });

  if (decision.kind === "idle") return;

  if (current && decision.claimCurrent) {
    const claim = await tx.ftwRoomProblem.updateMany({
      where: { id: current.id, lockedAt: null },
      data: { lockedAt: new Date() },
    });
    if (claim.count !== 1) return;

    // The conditional round claim and score increments share this transaction.
    // Only the request that changes lockedAt from null may apply these points.
    for (const answer of current.answers) {
      if (answer.points <= 0) continue;
      await tx.ftwRoomPlayer.update({
        where: { id: answer.playerId },
        data: { score: { increment: answer.points } },
      });
    }
  }

  if (decision.kind === "wait-for-host") return;

  if (decision.kind === "complete") {
    await tx.ftwRoom.update({
      where: { id: roomId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return;
  }

  await pickNextRoomProblemLocked(tx, roomId);
}

export async function advanceRoomIfDue(roomId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (!(await lockFtwRoom(tx, roomId))) return;
    await advanceRoomIfDueLocked(tx, roomId);
  });
}

export async function advanceRoomNow(
  roomId: string,
  userId: string,
): Promise<{
  ok: boolean;
  reason?: string;
}> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockFtwRoom(tx, roomId))) {
      return { ok: false, reason: "Room not running." };
    }

    const room = await tx.ftwRoom.findUnique({
      where: { id: roomId },
      include: {
        problems: { orderBy: { problemIndex: "desc" }, take: 1 },
      },
    });
    if (!room || room.status !== "IN_PROGRESS") {
      return { ok: false, reason: "Room not running." };
    }
    if (room.hostId !== userId) {
      return { ok: false, reason: "Only the host can advance." };
    }
    const current = room.problems[0];
    if (current && !current.lockedAt) {
      return { ok: false, reason: "Round still live." };
    }

    if (current && room.currentIndex + 1 >= room.totalProblems) {
      await tx.ftwRoom.update({
        where: { id: roomId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return { ok: true };
    }

    await pickNextRoomProblemLocked(tx, roomId);
    return { ok: true };
  });
}

export type StartRoomResult =
  | { kind: "started" }
  | {
      kind: "room-not-found" | "not-host" | "already-started" | "no-players" | "no-problems";
    };

export async function startRoom(roomId: string, userId: string): Promise<StartRoomResult> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockFtwRoom(tx, roomId))) return { kind: "room-not-found" };

    const room = await tx.ftwRoom.findUnique({
      where: { id: roomId },
      include: { players: { select: { id: true } } },
    });
    if (!room) return { kind: "room-not-found" };
    if (room.hostId !== userId) return { kind: "not-host" };
    if (room.status !== "LOBBY") return { kind: "already-started" };
    if (room.players.length === 0) return { kind: "no-players" };

    await tx.ftwRoom.update({
      where: { id: room.id },
      data: { status: "IN_PROGRESS", startedAt: new Date(), currentIndex: -1 },
    });

    const next = await pickNextRoomProblemLocked(tx, room.id);
    if (!next) {
      await tx.ftwRoom.update({
        where: { id: room.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return { kind: "no-problems" };
    }

    return { kind: "started" };
  });
}

export type SubmitRoomAnswerResult =
  | { kind: "submitted" }
  | {
      kind:
        | "room-not-running"
        | "not-in-room"
        | "problem-not-found"
        | "problem-locked"
        | "already-submitted";
    };

export async function submitRoomAnswer(input: {
  roomId: string;
  userId: string;
  problemIndex: number;
  rawAnswer: string;
}): Promise<SubmitRoomAnswerResult> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockFtwRoom(tx, input.roomId))) return { kind: "room-not-running" };

    const room = await tx.ftwRoom.findUnique({
      where: { id: input.roomId },
      include: {
        players: { where: { userId: input.userId, leftAt: null }, select: { id: true } },
      },
    });
    if (!room || room.status !== "IN_PROGRESS") return { kind: "room-not-running" };
    const player = room.players[0];
    if (!player) return { kind: "not-in-room" };

    const roomProblem = await tx.ftwRoomProblem.findUnique({
      where: {
        roomId_problemIndex: {
          roomId: room.id,
          problemIndex: input.problemIndex,
        },
      },
      include: { problem: true },
    });
    if (!roomProblem) return { kind: "problem-not-found" };
    if (roomProblem.lockedAt) return { kind: "problem-locked" };

    const now = new Date();
    const elapsedMs = now.getTime() - roomProblem.servedAt.getTime();
    const timedOut = now.getTime() >= roomProblem.endsAt.getTime();
    const { isCorrect } = timedOut
      ? { isCorrect: false }
      : gradeAnswer({
          rawAnswer: input.rawAnswer,
          answerType: ANSWER_TYPE_MAP[roomProblem.problem.answerType],
          answerKey: roomProblem.problem.answerKey,
          acceptedAnswers: roomProblem.problem.acceptedAnswers,
          caseSensitive: roomProblem.problem.caseSensitive,
        });
    const points = timedOut ? 0 : roomScore(elapsedMs, room.problemLimitMs, isCorrect);

    const created = await tx.ftwRoomAnswer.createMany({
      data: {
        roomProblemId: roomProblem.id,
        playerId: player.id,
        userId: input.userId,
        rawAnswer: input.rawAnswer,
        submittedAt: now,
        elapsedMs,
        isCorrect: timedOut ? false : isCorrect,
        points,
      },
      skipDuplicates: true,
    });
    if (created.count !== 1) return { kind: "already-submitted" };

    await advanceRoomIfDueLocked(tx, room.id);
    return { kind: "submitted" };
  });
}
