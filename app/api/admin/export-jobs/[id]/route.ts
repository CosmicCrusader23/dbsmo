import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:export")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const job = await prisma.exportJob.findFirst({
    where: { id, requestedById: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (job.status !== "COMPLETED" || !job.payload || typeof job.payload !== "object") {
    return NextResponse.json({ error: "Export is not complete." }, { status: 409 });
  }

  const content = "content" in job.payload ? String(job.payload.content ?? "") : "";
  return new NextResponse(content, {
    headers: {
      "Content-Type": job.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${job.fileName ?? "export.txt"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
