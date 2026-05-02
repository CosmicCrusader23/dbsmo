import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [problems, practiceScore] = await Promise.all([
    prisma.problem.findMany({
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
        topicTags: true,
      },
    }),
    prisma.practiceSolve.count({
      where: { userId: session.user.id },
    }),
  ]);

  const tagCounts: Record<string, number> = {};

  for (const problem of problems) {
    for (const tag of problem.topicTags) {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) continue;
      // Use original casing from the first occurrence, or just use lowercase
      // Let's keep original casing but group by lowercase
      const key = normalized;
      tagCounts[key] = (tagCounts[key] || 0) + 1;
    }
  }

  const validTags = Object.entries(tagCounts)
    .filter(([, count]) => count > 10)
    .map(([tag]) => tag)
    .sort();

  return NextResponse.json({ tags: validTags, practiceScore });
}
