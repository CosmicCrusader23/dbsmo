import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const [tag] = normalizeTagList([searchParams.get("tag") ?? ""]);

  if (!tag) {
    return NextResponse.json({ error: "Tag is required" }, { status: 400 });
  }

  const now = new Date();
  const where = {
    problemSet: {
      status: "PUBLISHED",
      AND: [
        { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
        { OR: [{ visibleTo: null }, { visibleTo: { gte: now } }] },
      ],
    },
    practiceSolves: {
      none: {
        userId: session.user.id,
      },
    },
    ...(tag.toLowerCase() === "endless" ? {} : { topicTags: { has: tag } }),
  } satisfies Prisma.ProblemWhereInput;

  const remaining = await prisma.problem.count({ where });
  if (remaining === 0) {
    return NextResponse.json({
      problem: null,
      message: "No more unsolved problems for this category!",
    });
  }

  const select = {
    id: true,
    statement: true,
    contentFormat: true,
    topicTags: true,
    problemSet: {
      select: {
        title: true,
      },
    },
  } as const;

  // Fetch only the randomly selected row instead of materializing every
  // statement in memory. Fall back to the first row if the solved set changed
  // between the count and select queries.
  const randomProblem =
    (await prisma.problem.findFirst({
      where,
      orderBy: { id: "asc" },
      skip: Math.floor(Math.random() * remaining),
      select,
    })) ??
    (await prisma.problem.findFirst({
      where,
      orderBy: { id: "asc" },
      select,
    }));

  if (!randomProblem) {
    return NextResponse.json({
      problem: null,
      message: "No more unsolved problems for this category!",
    });
  }

  return NextResponse.json({ problem: randomProblem });
}
