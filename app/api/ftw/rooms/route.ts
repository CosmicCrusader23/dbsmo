import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import {
  ROOM_DEFAULT_LIMIT_MS,
  ROOM_DEFAULT_TOTAL,
  generateRoomCode,
} from "@/lib/ftw-room";

export const runtime = "nodejs";

const createSchema = z.object({
  tag: z.string().optional().nullable(),
  totalProblems: z.number().int().min(3).max(20).optional(),
  problemLimitMs: z.number().int().min(15000).max(120000).optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const requestedTag = parsed.data.tag ?? null;
  const [normalized] = requestedTag ? normalizeTagList([requestedTag]) : [null];
  const tag = normalized && normalized.toLowerCase() !== "any" ? normalized : null;
  const totalProblems = parsed.data.totalProblems ?? ROOM_DEFAULT_TOTAL;
  const problemLimitMs = parsed.data.problemLimitMs ?? ROOM_DEFAULT_LIMIT_MS;

  const now = new Date();
  const candidateCount = await prisma.problem.count({
    where: {
      problemSet: {
        status: "PUBLISHED",
        AND: [
          { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
          { OR: [{ visibleTo: null }, { visibleTo: { gte: now } }] },
        ],
      },
      ...(tag ? { topicTags: { has: tag } } : {}),
    },
  });

  if (candidateCount < totalProblems) {
    return NextResponse.json(
      { error: `Need ≥${totalProblems} problems, only ${candidateCount} available.` },
      { status: 400 },
    );
  }

  let code = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.ftwRoom.findUnique({ where: { code } });
    if (!existing) break;
    code = generateRoomCode();
  }

  const room = await prisma.ftwRoom.create({
    data: {
      code,
      hostId: session.user.id,
      tag,
      totalProblems,
      problemLimitMs,
      players: {
        create: { userId: session.user.id },
      },
    },
  });

  return NextResponse.json({ code: room.code, roomId: room.id });
}
