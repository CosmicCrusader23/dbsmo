import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import {
  FTW_PROBLEMS_PER_MATCH,
  maxScoreForMatch,
} from "@/lib/ftw";

export const runtime = "nodejs";

const startSchema = z.object({
  tag: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const requestedTag = parsed.data.tag ?? null;
  const [normalized] = requestedTag ? normalizeTagList([requestedTag]) : [null];
  const tag = normalized && normalized.toLowerCase() !== "any" ? normalized : null;

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

  if (candidateCount < FTW_PROBLEMS_PER_MATCH) {
    return NextResponse.json(
      {
        error:
          tag !== null
            ? `Only ${candidateCount} problem(s) available for ${tag}. Need at least ${FTW_PROBLEMS_PER_MATCH}.`
            : `Only ${candidateCount} problem(s) available overall. Need at least ${FTW_PROBLEMS_PER_MATCH}.`,
      },
      { status: 400 },
    );
  }

  const match = await prisma.ftwMatch.create({
    data: {
      userId: session.user.id,
      tag,
      totalProblems: FTW_PROBLEMS_PER_MATCH,
      maxScore: maxScoreForMatch(FTW_PROBLEMS_PER_MATCH),
    },
  });

  return NextResponse.json({ matchId: match.id });
}
