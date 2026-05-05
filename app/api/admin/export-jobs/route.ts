import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ExportJobType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { buildAttemptsCsv, buildBackupJson, buildStudentsCsv } from "@/lib/admin-exports";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

function jobFile(type: ExportJobType) {
  if (type === "STUDENTS_CSV")
    return { fileName: "students.csv", mimeType: "text/csv; charset=utf-8" };
  if (type === "BACKUP_JSON")
    return { fileName: "dbsmo-backup.json", mimeType: "application/json; charset=utf-8" };
  return { fileName: "attempts.csv", mimeType: "text/csv; charset=utf-8" };
}

async function buildPayload(type: ExportJobType) {
  if (type === "STUDENTS_CSV") return buildStudentsCsv();
  if (type === "BACKUP_JSON") return buildBackupJson();
  return buildAttemptsCsv();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:export")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const jobs = await prisma.exportJob.findMany({
    where: { requestedById: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      type: true,
      status: true,
      fileName: true,
      mimeType: true,
      error: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:export")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { type?: string } | null;
  const type = body?.type as ExportJobType | undefined;
  if (!type || !Object.values(ExportJobType).includes(type)) {
    return NextResponse.json({ error: "Invalid export job type." }, { status: 422 });
  }

  const { fileName, mimeType } = jobFile(type);
  const job = await prisma.exportJob.create({
    data: {
      type,
      status: "RUNNING",
      requestedById: session.user.id,
      fileName,
      mimeType,
    },
  });

  try {
    const content = await buildPayload(type);
    const completed = await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        payload: { content },
        completedAt: new Date(),
      },
      select: { id: true, type: true, status: true, fileName: true, completedAt: true },
    });

    await recordAuditLog({
      actorId: session.user.id,
      action: "export_job.create",
      targetType: "ExportJob",
      targetId: completed.id,
      metadata: { type },
    });

    return NextResponse.json({ job: completed }, { status: 201 });
  } catch (error) {
    const failed = await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Export failed.",
        completedAt: new Date(),
      },
      select: { id: true, type: true, status: true, error: true },
    });
    return NextResponse.json({ job: failed }, { status: 500 });
  }
}
