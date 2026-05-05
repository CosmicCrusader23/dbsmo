import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { FeedbackStatus } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

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

    const body = await req.json();
    const { reportId, status, adminNote } = body;

    if (!reportId || !status) {
      return NextResponse.json({ error: "Missing reportId or status" }, { status: 400 });
    }

    if (!Object.values(FeedbackStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const update: Record<string, unknown> = { status: status as FeedbackStatus };
    if (adminNote !== undefined) update.adminNote = adminNote;
    if (status === "RESOLVED" || status === "REJECTED") {
      update.resolvedAt = new Date();
    }

    const report = await prisma.feedbackReport.update({
      where: { id: reportId },
      data: update,
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
    console.error("Failed to update feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
