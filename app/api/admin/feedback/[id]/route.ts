import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import {
  adminFeedbackUpdateSchema,
  buildFeedbackUpdateData,
  MAX_ADMIN_FEEDBACK_BODY_BYTES,
} from "@/lib/admin-feedback-policy";
import { readJsonBody } from "@/lib/http-body";
import { isPrismaKnownError } from "@/lib/prisma-errors";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !hasPermission(session.user.role, "admin:feedback")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonBody(req, { maxBytes: MAX_ADMIN_FEEDBACK_BODY_BYTES });
    if (!body.ok) {
      return NextResponse.json(
        { error: body.reason === "too_large" ? "Request is too large" : "Invalid JSON" },
        { status: body.reason === "too_large" ? 413 : 400 },
      );
    }

    const parsed = adminFeedbackUpdateSchema.safeParse(body.value);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const report = await prisma.feedbackReport.update({
      where: { id },
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
    console.error("Failed to update feedback report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !hasPermission(session.user.role, "admin:feedback")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await prisma.feedbackReport.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== "RESOLVED" && report.status !== "REJECTED") {
      return NextResponse.json(
        { error: "Only resolved or rejected reports can be deleted." },
        { status: 422 },
      );
    }

    await prisma.feedbackReport.delete({
      where: { id },
    });

    await recordAuditLog({
      actorId: session.user.id,
      action: "feedback.delete",
      targetType: "FeedbackReport",
      targetId: id,
      metadata: { status: report.status },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaKnownError(error, "P2025")) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    console.error("Failed to delete feedback report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
