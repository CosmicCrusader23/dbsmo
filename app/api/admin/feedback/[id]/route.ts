import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { FeedbackStatus, Prisma } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !hasPermission(session.user.role, "admin:feedback")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { status?: unknown; adminNote?: unknown };
    const { status, adminNote } = body;

    if (
      typeof status !== "string" ||
      !Object.values(FeedbackStatus).includes(status as FeedbackStatus)
    ) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const nextStatus = status as FeedbackStatus;
    const updateData: Prisma.FeedbackReportUpdateInput = { status: nextStatus };
    if (adminNote !== undefined)
      updateData.adminNote = adminNote === null ? null : String(adminNote);
    if (nextStatus === "RESOLVED" || nextStatus === "REJECTED") {
      updateData.resolvedAt = new Date();
    } else {
      updateData.resolvedAt = null;
    }

    const report = await prisma.feedbackReport.update({
      where: { id },
      data: updateData,
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
    console.error("Failed to delete feedback report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
