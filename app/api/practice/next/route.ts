import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
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
  // Find problems matching the tag from published sets, excluding those already solved in practice by this user
  const problems = await prisma.problem.findMany({
    where: {
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
      topicTags: {
        has: tag,
      },
    },
    select: {
      id: true,
      statement: true,
      contentFormat: true,
      topicTags: true,
      problemSet: {
        select: {
          title: true,
        },
      },
    },
  });

  if (problems.length === 0) {
    return NextResponse.json({
      problem: null,
      message: "No more unsolved problems for this category!",
    });
  }

  // Pick a random problem
  const randomProblem = problems[Math.floor(Math.random() * problems.length)];

  return NextResponse.json({ problem: randomProblem });
}
