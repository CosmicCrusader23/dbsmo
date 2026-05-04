import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { problemSetToImportJson } from "@/lib/import/problem-set-json-export";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function exportFileName(slug: string) {
  return `${slug.replace(/[^a-z0-9-]+/gi, "-") || "problem-set"}.json`;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const set = await prisma.problemSet.findUnique({
    where: { id },
    include: {
      problems: { orderBy: { number: "asc" } },
    },
  });

  if (!set) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(problemSetToImportJson(set), {
    headers: {
      "Content-Disposition": `attachment; filename="${exportFileName(set.slug)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
