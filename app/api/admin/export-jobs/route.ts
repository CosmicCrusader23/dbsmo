import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ExportJobType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  AdminExportLimitError,
  buildAttemptsCsv,
  buildBackupJson,
  buildStudentsCsv,
} from "@/lib/admin-exports";
import { ADMIN_EXPORT_LIMITS } from "@/lib/admin-export-safety";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const BACKUP_JOB_COOLDOWN_MS = 60_000;
const STORED_CONTENT_MAX_BYTES = ADMIN_EXPORT_LIMITS.exportJobPayloadBytes - 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jobFile(type: ExportJobType) {
  if (type === "STUDENTS_CSV")
    return { fileName: "students.csv", mimeType: "text/csv; charset=utf-8" };
  if (type === "BACKUP_JSON")
    return { fileName: "dbsmo-backup.json", mimeType: "application/json; charset=utf-8" };
  return { fileName: "attempts.csv", mimeType: "text/csv; charset=utf-8" };
}

async function buildPayload(type: ExportJobType) {
  const options = { maxOutputBytes: STORED_CONTENT_MAX_BYTES };
  if (type === "STUDENTS_CSV") return buildStudentsCsv(options);
  if (type === "BACKUP_JSON") return buildBackupJson(options);
  return buildAttemptsCsv(options);
}

async function reserveExportJob(type: ExportJobType, requestedById: string) {
  const { fileName, mimeType } = jobFile(type);
  if (type !== "BACKUP_JSON") {
    const job = await prisma.exportJob.create({
      data: { type, status: "RUNNING", requestedById, fileName, mimeType },
    });
    return { conflict: null, job };
  }

  return prisma.$transaction(async (tx) => {
    // Serialize reservations for this user without requiring a schema change.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('dbsmo-backup-export'),
        hashtext(${requestedById})
      )
    `;

    const now = Date.now();
    const conflict = await tx.exportJob.findFirst({
      where: {
        requestedById,
        type: "BACKUP_JSON",
        OR: [
          { createdAt: { gte: new Date(now - BACKUP_JOB_COOLDOWN_MS) } },
          { status: { in: ["PENDING", "RUNNING"] } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        fileName: true,
        error: true,
        createdAt: true,
        completedAt: true,
      },
    });
    if (conflict) return { conflict, job: null };

    const job = await tx.exportJob.create({
      data: { type, status: "RUNNING", requestedById, fileName, mimeType },
    });
    return { conflict: null, job };
  });
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

  const body = await readJsonBody(request, {
    maxBytes: ADMIN_EXPORT_LIMITS.exportJobRequestBytes,
  });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Export job request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rawType = isRecord(body.value) ? body.value.type : undefined;
  const type = rawType as ExportJobType | undefined;
  if (!type || !Object.values(ExportJobType).includes(type)) {
    return NextResponse.json({ error: "Invalid export job type." }, { status: 422 });
  }

  let reservation: Awaited<ReturnType<typeof reserveExportJob>>;
  try {
    reservation = await reserveExportJob(type, session.user.id);
  } catch (error) {
    console.error("Failed to reserve export job:", error);
    return NextResponse.json({ error: "Export job could not be started." }, { status: 500 });
  }
  if (reservation.conflict || !reservation.job) {
    return NextResponse.json(
      {
        error: "A backup export is already active or was requested recently.",
        job: reservation.conflict,
      },
      { status: 409 },
    );
  }
  const job = reservation.job;

  try {
    const content = await buildPayload(type);
    const payload = { content };
    if (
      Buffer.byteLength(JSON.stringify(payload), "utf8") > ADMIN_EXPORT_LIMITS.exportJobPayloadBytes
    ) {
      throw new AdminExportLimitError("Export is too large to retain as a stored job.");
    }

    const completed = await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        payload,
        completedAt: new Date(),
      },
      select: { id: true, type: true, status: true, fileName: true, completedAt: true },
    });

    await recordAuditLog({
      actorId: session.user.id,
      action: "export_job.create",
      targetType: "ExportJob",
      targetId: completed.id,
      metadata: { type, payloadBytes: Buffer.byteLength(content, "utf8") },
    });

    return NextResponse.json({ job: completed }, { status: 201 });
  } catch (error) {
    const publicError =
      error instanceof AdminExportLimitError ? error.message : "Export could not be generated.";
    if (!(error instanceof AdminExportLimitError)) {
      console.error(`Failed to build export job ${job.id}:`, error);
    }
    const failed = await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        payload: undefined,
        error: publicError.replace(/[\r\n]+/g, " ").slice(0, 500),
        completedAt: new Date(),
      },
      select: { id: true, type: true, status: true, error: true },
    });
    return NextResponse.json(
      { job: failed },
      { status: error instanceof AdminExportLimitError ? 413 : 500 },
    );
  }
}
