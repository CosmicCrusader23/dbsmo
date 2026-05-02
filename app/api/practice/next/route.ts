import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag")?.toLowerCase();

  if (!tag) {
    return NextResponse.json({ error: "Tag is required" }, { status: 400 });
  }

  // Find problems matching the tag from published sets, excluding those already solved in practice by this user
  const problems = await prisma.problem.findMany({
    where: {
      problemSet: {
        status: "PUBLISHED",
      },
      practiceSolves: {
        none: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      statement: true,
      topicTags: true,
      problemSet: {
        select: {
          title: true,
        },
      },
    },
  });

  const matchingProblems = problems.filter((p) =>
    p.topicTags.some((t) => t.trim().toLowerCase() === tag)
  );

  if (matchingProblems.length === 0) {
    return NextResponse.json({ problem: null, message: "No more unsolved problems for this category!" });
  }

  // Pick a random problem
  const randomProblem = matchingProblems[Math.floor(Math.random() * matchingProblems.length)];

  return NextResponse.json({ problem: randomProblem });
}
