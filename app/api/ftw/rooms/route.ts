import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import { readJsonBody } from "@/lib/http-body";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { ROOM_DEFAULT_LIMIT_MS, ROOM_DEFAULT_TOTAL, generateRoomCode } from "@/lib/ftw-room";

export const runtime = "nodejs";

const createSchema = z.object({
  tag: z.string().max(64).optional().nullable(),
  totalProblems: z.number().int().min(3).max(20).optional(),
  problemLimitMs: z.number().int().min(15000).max(120000).optional(),
});
const MAX_FTW_REQUEST_BYTES = 2_048;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown = {};
  if (request.body) {
    const parsedBody = await readJsonBody(request, { maxBytes: MAX_FTW_REQUEST_BYTES });
    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: parsedBody.reason === "too_large" ? "Request is too large." : "Invalid JSON." },
        { status: parsedBody.reason === "too_large" ? 413 : 400 },
      );
    }
    body = parsedBody.value;
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

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateRoomCode();
    try {
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
    } catch (error) {
      if (isPrismaUniqueViolation(error)) continue;
      throw error;
    }
  }

  return NextResponse.json({ error: "Could not allocate a room code." }, { status: 503 });
}
