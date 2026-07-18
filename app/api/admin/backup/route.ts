import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { AdminExportLimitError, buildBackupJson } from "@/lib/admin-exports";
import {
  ADMIN_EXPORT_LIMITS,
  decodeVerifiedBackupFile,
  inspectBackupFileContent,
  parseBackupFileRelations,
  validateBackupStorageKey,
  type BackupFileRelations,
  type InspectedBackupFileContent,
} from "@/lib/admin-export-safety";
import { importProblemSetJson } from "@/lib/import/json-import";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { deleteFile, saveFile } from "@/lib/storage";
import { isCrossSiteBrowserRequest, readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

type BackupPayload = {
  problemSets: unknown[];
  importedFiles?: unknown[];
  schema: string;
};

type FailedItem = {
  error: string;
  slug?: string;
  storageKey?: string;
};

type ProblemSetPlan = {
  slug: string;
  sizeBytes: number;
  text: string;
};

type FilePlan = {
  content: InspectedBackupFileContent;
  index: number;
  record: Record<string, unknown>;
  relations: BackupFileRelations;
  storageKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result && result.length <= maxLength ? result : null;
}

function setLabel(value: unknown, index: number): string {
  if (isRecord(value)) {
    const slug = boundedString(value.slug, 100);
    if (slug) return slug;
  }
  return `invalid-set-${index + 1}`;
}

function fileLabel(value: unknown, index: number): string {
  if (isRecord(value)) {
    const key = validateBackupStorageKey(value.storageKey);
    if (key) return key;
  }
  return `invalid-file-${index + 1}`;
}

async function deleteUnclaimedBackupFile(storageKey: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('dbsmo-backup-file'),
        hashtext(${storageKey})
      )
    `;
    const claimed = await tx.importedFile.findUnique({
      where: { storageKey },
      select: { id: true },
    });
    if (!claimed) await deleteFile(storageKey);
  });
}

export async function GET(request: Request) {
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

  try {
    const json = await buildBackupJson();
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="dbsmo-backup.json"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AdminExportLimitError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    console.error("Failed to build admin backup:", error);
    return NextResponse.json({ error: "Backup could not be generated." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin:content")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await readJsonBody(request, { maxBytes: ADMIN_EXPORT_LIMITS.backupBodyBytes });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Backup payload is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (
    !isRecord(body.value) ||
    body.value.schema !== "dbsmo-backup-v1" ||
    !Array.isArray(body.value.problemSets) ||
    (body.value.importedFiles !== undefined && !Array.isArray(body.value.importedFiles))
  ) {
    return NextResponse.json({ error: "Invalid DBSMO backup payload." }, { status: 422 });
  }
  const payload = body.value as BackupPayload;
  const importedFiles = payload.importedFiles ?? [];
  if (payload.problemSets.length > ADMIN_EXPORT_LIMITS.backupProblemSetCount) {
    return NextResponse.json(
      { error: `Backup has more than ${ADMIN_EXPORT_LIMITS.backupProblemSetCount} problem sets.` },
      { status: 413 },
    );
  }
  if (importedFiles.length > ADMIN_EXPORT_LIMITS.backupFileCount) {
    return NextResponse.json(
      { error: `Backup has more than ${ADMIN_EXPORT_LIMITS.backupFileCount} files.` },
      { status: 413 },
    );
  }
  const rawProblemCount = payload.problemSets.reduce<number>(
    (sum, set) => sum + (isRecord(set) && Array.isArray(set.problems) ? set.problems.length : 0),
    0,
  );
  if (rawProblemCount > ADMIN_EXPORT_LIMITS.backupProblemCount) {
    return NextResponse.json(
      { error: `Backup has more than ${ADMIN_EXPORT_LIMITS.backupProblemCount} problems.` },
      { status: 413 },
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];
  const failedSets: FailedItem[] = [];
  const failedFiles: FailedItem[] = [];

  const problemSetPlans: ProblemSetPlan[] = [];
  let problemSetBytes = 0;
  for (const [index, problemSet] of payload.problemSets.entries()) {
    const label = setLabel(problemSet, index);
    if (!isRecord(problemSet)) {
      skipped.push(label);
      failedSets.push({ slug: label, error: "Problem set entry is not an object." });
      continue;
    }
    const slug = boundedString(problemSet.slug, 100);
    if (!slug) {
      skipped.push(label);
      failedSets.push({ slug: label, error: "Problem set slug is missing or too long." });
      continue;
    }

    const text = JSON.stringify(problemSet);
    const sizeBytes = Buffer.byteLength(text, "utf8");
    if (sizeBytes > ADMIN_EXPORT_LIMITS.backupProblemSetBytes) {
      skipped.push(slug);
      failedSets.push({ slug, error: "Problem set exceeds the per-set restore limit." });
      continue;
    }
    if (problemSetBytes + sizeBytes > ADMIN_EXPORT_LIMITS.backupProblemSetsBytes) {
      skipped.push(slug);
      failedSets.push({ slug, error: "Problem set exceeds the aggregate restore limit." });
      continue;
    }
    problemSetBytes += sizeBytes;
    problemSetPlans.push({ slug, sizeBytes, text });
  }

  const filePlans: FilePlan[] = [];
  const seenStorageKeys = new Set<string>();
  let acceptedDecodedBytes = 0;
  let acceptedEncodedBytes = 0;
  let payloadEncodedBytes = 0;
  for (const [index, file] of importedFiles.entries()) {
    const label = fileLabel(file, index);
    if (!isRecord(file)) {
      skippedFiles.push(label);
      failedFiles.push({ storageKey: label, error: "File entry is not an object." });
      continue;
    }

    const dataBase64 = file.dataBase64;
    if (typeof dataBase64 === "string") {
      payloadEncodedBytes += Buffer.byteLength(dataBase64, "ascii");
    }
    const errors: string[] = [];
    if (payloadEncodedBytes > ADMIN_EXPORT_LIMITS.backupEncodedBytes) {
      errors.push("Backup exceeds the aggregate encoded file limit.");
    }

    const storageKey = validateBackupStorageKey(file.storageKey);
    if (!storageKey) errors.push("Storage key is invalid.");
    else if (seenStorageKeys.has(storageKey))
      errors.push("Storage key is duplicated in the backup.");

    const relations = parseBackupFileRelations(file.relations);
    if (!relations.ok) errors.push(relations.error);
    else if (
      relations.relations.problemFileFor.length + relations.relations.solutionFileFor.length ===
      0
    ) {
      errors.push("File has no supported problem/solution relation and would become orphaned.");
    }

    let inspected: ReturnType<typeof inspectBackupFileContent> | null = null;
    if (errors.length === 0) {
      inspected = inspectBackupFileContent(
        { checksum: file.checksum, dataBase64, sizeBytes: file.sizeBytes },
        {
          maxDecodedBytes: ADMIN_EXPORT_LIMITS.backupDecodedBytes - acceptedDecodedBytes,
          maxEncodedBytes: ADMIN_EXPORT_LIMITS.backupEncodedBytes - acceptedEncodedBytes,
        },
      );
      if (!inspected.ok) errors.push(inspected.error);
    }

    if (errors.length > 0 || !storageKey || !relations.ok || !inspected?.ok) {
      skippedFiles.push(label);
      failedFiles.push({ storageKey: label, error: errors.join(" ").slice(0, 500) });
      continue;
    }

    seenStorageKeys.add(storageKey);
    acceptedDecodedBytes += inspected.content.decodedBytes;
    acceptedEncodedBytes += inspected.content.encodedBytes;
    filePlans.push({
      content: inspected.content,
      index,
      record: file,
      relations: relations.relations,
      storageKey,
    });
  }

  const candidateSlugs = [...new Set(problemSetPlans.map((plan) => plan.slug))];
  const existingSlugs = new Set(
    (
      await prisma.problemSet.findMany({
        where: { slug: { in: candidateSlugs } },
        select: { slug: true },
      })
    ).map((set) => set.slug),
  );
  const createdSetIds = new Map<string, string>();

  for (const plan of problemSetPlans) {
    if (existingSlugs.has(plan.slug)) {
      skipped.push(plan.slug);
      continue;
    }

    try {
      const result = await importProblemSetJson({
        fileName: `${plan.slug}.json`,
        sizeBytes: plan.sizeBytes,
        text: plan.text,
        uploadedById: session.user.id,
      });
      if (result.ok && result.created) {
        created.push(result.created.slug);
        existingSlugs.add(result.created.slug);
        createdSetIds.set(result.created.slug, result.created.problemSetId);
      } else {
        skipped.push(plan.slug);
        const issues = result.issues.map((issue) => issue.message).join(" ");
        failedSets.push({ slug: plan.slug, error: issues.slice(0, 500) || "Import failed." });
      }
    } catch (error) {
      console.error(`Failed to restore problem set ${plan.slug}:`, error);
      skipped.push(plan.slug);
      failedSets.push({ slug: plan.slug, error: "Import failed." });
    }
  }

  const existingFileKeys = new Set(
    filePlans.length
      ? (
          await prisma.importedFile.findMany({
            where: { storageKey: { in: filePlans.map((plan) => plan.storageKey) } },
            select: { storageKey: true },
          })
        ).map((file) => file.storageKey)
      : [],
  );
  const claimedRelations = new Set<string>();

  // Decode, verify, save, and associate one file at a time to bound peak memory.
  for (const plan of filePlans) {
    if (existingFileKeys.has(plan.storageKey)) {
      skippedFiles.push(plan.storageKey);
      failedFiles.push({
        storageKey: plan.storageKey,
        error: "Storage key already exists; the file was not restored or attached.",
      });
      continue;
    }

    const partialErrors: string[] = [];
    const problemTargets = plan.relations.problemFileFor
      .map((slug) => ({ id: createdSetIds.get(slug), key: `problem:${slug}`, slug }))
      .filter((target): target is { id: string; key: string; slug: string } => Boolean(target.id));
    const solutionTargets = plan.relations.solutionFileFor
      .map((slug) => ({ id: createdSetIds.get(slug), key: `solution:${slug}`, slug }))
      .filter((target): target is { id: string; key: string; slug: string } => Boolean(target.id));
    const unavailableTargets = [
      ...plan.relations.problemFileFor.filter((slug) => !createdSetIds.has(slug)),
      ...plan.relations.solutionFileFor.filter((slug) => !createdSetIds.has(slug)),
    ];
    if (unavailableTargets.length > 0) {
      partialErrors.push("Relations to existing or failed problem sets were not modified.");
    }

    const availableProblemTargets = problemTargets.filter((target) => {
      if (claimedRelations.has(target.key)) {
        partialErrors.push(`Duplicate problem-file relation for ${target.slug} was skipped.`);
        return false;
      }
      return true;
    });
    const availableSolutionTargets = solutionTargets.filter((target) => {
      if (claimedRelations.has(target.key)) {
        partialErrors.push(`Duplicate solution-file relation for ${target.slug} was skipped.`);
        return false;
      }
      return true;
    });
    if (plan.relations.unsupportedRelations.length > 0) {
      partialErrors.push(
        `Unsupported relations were skipped: ${plan.relations.unsupportedRelations.join(", ")}.`,
      );
    }
    if (availableProblemTargets.length + availableSolutionTargets.length === 0) {
      skippedFiles.push(plan.storageKey);
      failedFiles.push({
        storageKey: plan.storageKey,
        error:
          partialErrors.join(" ").slice(0, 500) ||
          "No safe relation target was created; refusing to create an orphan file.",
      });
      continue;
    }

    const decoded = decodeVerifiedBackupFile(plan.content);
    if (!decoded.ok) {
      skippedFiles.push(plan.storageKey);
      failedFiles.push({ storageKey: plan.storageKey, error: decoded.error });
      continue;
    }

    let storageWriteAttempted = false;
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtext('dbsmo-backup-file'),
              hashtext(${plan.storageKey})
            )
          `;
          const claimed = await tx.importedFile.findUnique({
            where: { storageKey: plan.storageKey },
            select: { id: true },
          });
          if (claimed) {
            throw new Error("Storage key was claimed by another restore.");
          }

          const importedFile = await tx.importedFile.create({
            data: {
              storageKey: plan.storageKey,
              originalName:
                boundedString(plan.record.originalName, 255) ??
                plan.storageKey.split("/").pop()?.slice(0, 255) ??
                "file",
              mimeType: boundedString(plan.record.mimeType, 255) ?? "application/octet-stream",
              sizeBytes: decoded.buffer.byteLength,
              checksum: plan.content.checksum,
              uploadedById: session.user.id,
            },
          });
          storageWriteAttempted = true;
          await saveFile(plan.storageKey, decoded.buffer);

          if (availableProblemTargets.length > 0) {
            const updated = await tx.problemSet.updateMany({
              where: {
                id: { in: availableProblemTargets.map((target) => target.id) },
                problemFileId: null,
              },
              data: { problemFileId: importedFile.id },
            });
            if (updated.count !== availableProblemTargets.length) {
              throw new Error("A problem-file relation changed during restore.");
            }
          }
          if (availableSolutionTargets.length > 0) {
            const updated = await tx.problemSet.updateMany({
              where: {
                id: { in: availableSolutionTargets.map((target) => target.id) },
                solutionFileId: null,
              },
              data: { solutionFileId: importedFile.id },
            });
            if (updated.count !== availableSolutionTargets.length) {
              throw new Error("A solution-file relation changed during restore.");
            }
          }
        },
        { timeout: 60_000 },
      );

      availableProblemTargets.forEach((target) => claimedRelations.add(target.key));
      availableSolutionTargets.forEach((target) => claimedRelations.add(target.key));
      existingFileKeys.add(plan.storageKey);
      createdFiles.push(plan.storageKey);
      if (partialErrors.length > 0) {
        failedFiles.push({
          storageKey: plan.storageKey,
          error: partialErrors.join(" ").slice(0, 500),
        });
      }
    } catch (error) {
      console.error(`Failed to restore backup file ${plan.storageKey}:`, error);
      let cleanupError: unknown = null;
      if (storageWriteAttempted) {
        try {
          await deleteUnclaimedBackupFile(plan.storageKey);
        } catch (cleanupFailure) {
          cleanupError = cleanupFailure;
        }
      }
      skippedFiles.push(plan.storageKey);
      failedFiles.push({
        storageKey: plan.storageKey,
        error: cleanupError
          ? "File could not be restored. Cleanup could not be confirmed."
          : "File could not be restored.",
      });
    }
  }

  const ok = failedSets.length === 0 && failedFiles.length === 0;
  await recordAuditLog({
    actorId: session.user.id,
    action: "backup.restore_missing_sets",
    targetType: "Backup",
    metadata: {
      ok,
      created,
      skipped,
      createdFiles,
      skippedFiles,
      failedSets,
      failedFiles,
    },
  });

  return NextResponse.json({
    ok,
    created,
    skipped,
    createdFiles,
    skippedFiles,
    failedSets,
    failedFiles,
  });
}
