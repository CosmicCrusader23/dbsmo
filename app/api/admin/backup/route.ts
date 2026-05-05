import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { buildBackupJson } from "@/lib/admin-exports";
import { importProblemSetJson } from "@/lib/import/json-import";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { saveFile } from "@/lib/storage";

type BackupPayload = {
  problemSets?: unknown[];
  importedFiles?: unknown[];
  schema?: string;
};

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberField(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:export")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const json = await buildBackupJson();
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dbsmo-backup.json"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as BackupPayload | null;
  if (!payload || payload.schema !== "dbsmo-backup-v1" || !Array.isArray(payload.problemSets)) {
    return NextResponse.json({ error: "Invalid DBSMO backup payload." }, { status: 422 });
  }

  const existingSlugs = new Set(
    (
      await prisma.problemSet.findMany({
        select: { slug: true },
      })
    ).map((set) => set.slug),
  );
  const existingFiles = new Set(
    (
      await prisma.importedFile.findMany({
        select: { storageKey: true },
      })
    ).map((file) => file.storageKey),
  );
  const created: string[] = [];
  const skipped: string[] = [];
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];

  if (Array.isArray(payload.importedFiles)) {
    for (const file of payload.importedFiles) {
      if (!file || typeof file !== "object") {
        skippedFiles.push("invalid-file");
        continue;
      }

      const record = file as Record<string, unknown>;
      const storageKey = stringField(record.storageKey);
      const dataBase64 = typeof record.dataBase64 === "string" ? record.dataBase64 : null;

      if (!storageKey || !dataBase64 || existingFiles.has(storageKey)) {
        if (storageKey) skippedFiles.push(storageKey);
        continue;
      }

      try {
        const buffer = Buffer.from(dataBase64, "base64");
        await saveFile(storageKey, buffer);
        await prisma.importedFile.create({
          data: {
            storageKey,
            originalName: stringField(record.originalName) ?? storageKey.split("/").pop() ?? "file",
            mimeType: stringField(record.mimeType) ?? "application/octet-stream",
            sizeBytes: numberField(record.sizeBytes, buffer.length),
            checksum: stringField(record.checksum) ?? "",
            uploadedById: session.user.id,
          },
        });
        existingFiles.add(storageKey);
        createdFiles.push(storageKey);
      } catch {
        skippedFiles.push(storageKey);
      }
    }
  }

  for (const problemSet of payload.problemSets) {
    const slug =
      typeof problemSet === "object" && problemSet && "slug" in problemSet
        ? String(problemSet.slug)
        : "";
    if (!slug || existingSlugs.has(slug)) {
      if (slug) skipped.push(slug);
      continue;
    }

    const result = await importProblemSetJson({
      fileName: `${slug}.json`,
      sizeBytes: Buffer.byteLength(JSON.stringify(problemSet)),
      text: JSON.stringify(problemSet),
      uploadedById: session.user.id,
    });
    if (result.ok && result.created) {
      created.push(result.created.slug);
      existingSlugs.add(result.created.slug);
    }
  }

  await recordAuditLog({
    actorId: session.user.id,
    action: "backup.restore_missing_sets",
    targetType: "Backup",
    metadata: { created, skipped, createdFiles, skippedFiles },
  });

  return NextResponse.json({ ok: true, created, skipped, createdFiles, skippedFiles });
}
