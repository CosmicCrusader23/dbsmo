import { prisma } from "@/lib/db";

export async function pickNextRoomProblem(roomId: string): Promise<{
  roomProblemId: string;
  problemIndex: number;
  endsAt: Date;
} | null> {
  const room = await prisma.ftwRoom.findUnique({
    where: { id: roomId },
    include: { problems: { select: { problemId: true } } },
  });
  if (!room) return null;
  const used = room.problems.map((p) => p.problemId);

  const now = new Date();
  const candidates = await prisma.problem.findMany({
    where: {
      id: { notIn: used },
      problemSet: {
        status: "PUBLISHED",
        AND: [
          { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
          { OR: [{ visibleTo: null }, { visibleTo: { gte: now } }] },
        ],
      },
      ...(room.tag ? { topicTags: { has: room.tag } } : {}),
    },
    select: { id: true },
  });

  if (candidates.length === 0) return null;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const nextIndex = room.currentIndex + 1;
  const endsAt = new Date(now.getTime() + room.problemLimitMs);

  const created = await prisma.ftwRoomProblem.create({
    data: {
      roomId,
      problemId: picked.id,
      problemIndex: nextIndex,
      servedAt: now,
      endsAt,
    },
  });
  await prisma.ftwRoom.update({
    where: { id: roomId },
    data: { currentIndex: nextIndex },
  });
  return { roomProblemId: created.id, problemIndex: nextIndex, endsAt };
}

export async function advanceRoomIfDue(roomId: string): Promise<void> {
  const room = await prisma.ftwRoom.findUnique({
    where: { id: roomId },
    include: {
      players: { where: { leftAt: null }, select: { id: true } },
      problems: {
        orderBy: { problemIndex: "desc" },
        take: 1,
        include: { answers: { select: { id: true, playerId: true } } },
      },
    },
  });
  if (!room || room.status !== "IN_PROGRESS") return;
  const current = room.problems[0];
  const activePlayerIds = room.players.map((p) => p.id);
  const answered = new Set(current?.answers.map((a) => a.playerId) ?? []);

  const allAnswered =
    current !== undefined &&
    activePlayerIds.length > 0 &&
    activePlayerIds.every((id) => answered.has(id));
  const timedOut = current !== undefined && Date.now() >= current.endsAt.getTime();
  const noProblemYet = !current;

  if (!noProblemYet && !allAnswered && !timedOut) return;

  if (current && !current.lockedAt) {
    await prisma.ftwRoomProblem.update({
      where: { id: current.id },
      data: { lockedAt: new Date() },
    });
  }

  if (!noProblemYet && room.currentIndex + 1 >= room.totalProblems) {
    await prisma.ftwRoom.update({
      where: { id: roomId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return;
  }

  await pickNextRoomProblem(roomId);
}
