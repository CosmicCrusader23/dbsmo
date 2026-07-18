import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import {
  buildFeedbackUpdateData,
  legacyAdminFeedbackUpdateSchema,
  MAX_ADMIN_FEEDBACK_BODY_BYTES,
} from "@/lib/admin-feedback-policy";
import { readJsonBody } from "@/lib/http-body";
import { isPrismaKnownError } from "@/lib/prisma-errors";

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !hasPermission(user.role, "admin:feedback")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await readJsonBody(req, { maxBytes: MAX_ADMIN_FEEDBACK_BODY_BYTES });
    if (!body.ok) {
      return NextResponse.json(
        { error: body.reason === "too_large" ? "Request is too large" : "Invalid JSON" },
        { status: body.reason === "too_large" ? 413 : 400 },
      );
    }

    const parsed = legacyAdminFeedbackUpdateSchema.safeParse(body.value);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const report = await prisma.feedbackReport.update({
      where: { id: parsed.data.reportId },
      data: buildFeedbackUpdateData(parsed.data),
    });

    await recordAuditLog({
      actorId: session.user.id,
      action: "feedback.update",
      targetType: "FeedbackReport",
      targetId: report.id,
      metadata: { status: report.status },
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (isPrismaKnownError(error, "P2025")) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    console.error("Failed to update feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
