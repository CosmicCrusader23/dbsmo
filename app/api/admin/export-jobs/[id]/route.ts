import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { isCrossSiteBrowserRequest } from "@/lib/http-body";
import {
  ADMIN_EXPORT_LIMITS,
  extractStoredExportContent,
  safeAttachmentFileName,
} from "@/lib/admin-export-safety";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json({ error: "Cross-site export request rejected." }, { status: 403 });
  }
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
    select: {
      status: true,
      payload: true,
      fileName: true,
      mimeType: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (job.status !== "COMPLETED") {
    return NextResponse.json({ error: "Export is not complete." }, { status: 409 });
  }

  const stored = extractStoredExportContent(job.payload, ADMIN_EXPORT_LIMITS.exportJobPayloadBytes);
  if (!stored.ok) {
    return NextResponse.json(
      {
        error:
          stored.reason === "too_large"
            ? "Stored export exceeds the download limit. Generate a direct export instead."
            : "Stored export data is unavailable.",
      },
      { status: stored.reason === "too_large" ? 413 : 409 },
    );
  }

  const fileName = safeAttachmentFileName(job.fileName, "export.txt");
  return new NextResponse(stored.content, {
    headers: {
      "Content-Type": job.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
