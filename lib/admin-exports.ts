import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { computePerformanceProfile, performanceEvidenceLabel, toCsvRow } from "@/lib/analytics";
import { problemSetToImportJson } from "@/lib/import/problem-set-json-export";
import { readFileBufferBounded } from "@/lib/storage";
import { compareProblemSetRecords } from "@/lib/problem-set-order";
import { ADMIN_EXPORT_LIMITS } from "@/lib/admin-export-safety";
import { isVisibleToStudent } from "@/lib/visibility";

type ExportBuildOptions = {
  maxOutputBytes?: number;
};

export class AdminExportLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminExportLimitError";
  }
}

function outputLimit(options: ExportBuildOptions, fallback: number): number {
  const requested = options.maxOutputBytes;
  if (requested === undefined) return fallback;
  if (!Number.isSafeInteger(requested) || requested <= 0) {
    throw new AdminExportLimitError("Export output limit is invalid.");
  }
  return Math.min(requested, fallback);
}

type CsvAccumulator = {
  chunks: string[];
  maxBytes: number;
  totalBytes: number;
};

function createCsvAccumulator(header: string, maxBytes: number): CsvAccumulator {
  return { chunks: [header], maxBytes, totalBytes: Buffer.byteLength(header, "utf8") };
}

function appendCsvRow(csv: CsvAccumulator, row: string): void {
  csv.totalBytes += 1 + Buffer.byteLength(row, "utf8");
  if (csv.totalBytes > csv.maxBytes) {
    throw new AdminExportLimitError("CSV export exceeds the configured output limit.");
  }
  csv.chunks.push(row);
}

export async function buildStudentsCsv(options: ExportBuildOptions = {}) {
  const maxOutputBytes = outputLimit(options, ADMIN_EXPORT_LIMITS.csvOutputBytes);
  const header = toCsvRow([
    "Name",
    "Email",
    "Group",
    "Sets Attempted",
    "Mastery Index",
    "Best Set Average %",
    "Consistency Floor %",
    "Mastery Rate %",
    "Evidence",
    "Total Attempts",
  ]);
  const csv = createCsvAccumulator(header, maxOutputBytes);
  const pageSize = 500;
  let studentCursor: string | undefined;
  let studentCount = 0;
  let attemptCount = 0;
  const problemSets = await prisma.problemSet.findMany({
    select: { id: true, status: true, visibleFrom: true, visibleTo: true },
  });
  const visibleSetIds = new Set(
    problemSets.filter((set) => isVisibleToStudent(set)).map((set) => set.id),
  );

  while (true) {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, email: true, group: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: pageSize,
      ...(studentCursor ? { cursor: { id: studentCursor }, skip: 1 } : {}),
    });
    if (students.length === 0) break;
    studentCount += students.length;
    if (studentCount > ADMIN_EXPORT_LIMITS.csvStudentCount) {
      throw new AdminExportLimitError(
        `Student export exceeds the ${ADMIN_EXPORT_LIMITS.csvStudentCount} row limit.`,
      );
    }

    const remainingAttempts = ADMIN_EXPORT_LIMITS.csvAttemptCount - attemptCount;
    const attempts = await prisma.attempt.findMany({
      where: {
        userId: { in: students.map((student) => student.id) },
        problemSetId: { in: Array.from(visibleSetIds) },
      },
      select: { userId: true, score: true, maxScore: true, problemSetId: true },
      take: remainingAttempts + 1,
    });
    if (attempts.length > remainingAttempts) {
      throw new AdminExportLimitError(
        `Student export exceeds the ${ADMIN_EXPORT_LIMITS.csvAttemptCount} attempt limit.`,
      );
    }
    attemptCount += attempts.length;

    const attemptsByUser = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const userAttempts = attemptsByUser.get(attempt.userId);
      if (userAttempts) userAttempts.push(attempt);
      else attemptsByUser.set(attempt.userId, [attempt]);
    }
    for (const student of students) {
      const studentAttempts = attemptsByUser.get(student.id) ?? [];
      const performance = computePerformanceProfile(studentAttempts, visibleSetIds.size);
      appendCsvRow(
        csv,
        toCsvRow([
          student.name ?? "",
          student.email,
          student.group ?? "",
          String(performance.attemptedSets),
          performance.masteryIndex.toFixed(1),
          performance.bestSetAverage.toFixed(1),
          performance.consistency.toFixed(1),
          performance.masteryRate.toFixed(1),
          performanceEvidenceLabel(performance.evidence),
          String(studentAttempts.length),
        ]),
      );
    }

    studentCursor = students.at(-1)?.id;
    if (students.length < pageSize) break;
  }

  return csv.chunks.join("\n");
}

export async function buildAttemptsCsv(options: ExportBuildOptions = {}) {
  const maxOutputBytes = outputLimit(options, ADMIN_EXPORT_LIMITS.csvOutputBytes);
  const header = toCsvRow([
    "Student",
    "Email",
    "Problem Set",
    "Attempt #",
    "Score",
    "Max Score",
    "Percentage",
    "Date",
  ]);
  const csv = createCsvAccumulator(header, maxOutputBytes);
  const pageSize = 1000;
  let attemptCursor: string | undefined;
  let attemptCount = 0;

  while (true) {
    const remaining = ADMIN_EXPORT_LIMITS.csvAttemptCount - attemptCount;
    const attempts = await prisma.attempt.findMany({
      select: {
        id: true,
        attemptNumber: true,
        score: true,
        maxScore: true,
        submittedAt: true,
        user: { select: { name: true, email: true } },
        problemSet: { select: { title: true } },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: Math.min(pageSize, remaining + 1),
      ...(attemptCursor ? { cursor: { id: attemptCursor }, skip: 1 } : {}),
    });
    if (attempts.length === 0) break;
    if (attempts.length > remaining) {
      throw new AdminExportLimitError(
        `Attempt export exceeds the ${ADMIN_EXPORT_LIMITS.csvAttemptCount} row limit.`,
      );
    }
    attemptCount += attempts.length;

    for (const attempt of attempts) {
      appendCsvRow(
        csv,
        toCsvRow([
          attempt.user.name ?? "",
          attempt.user.email,
          attempt.problemSet.title,
          String(attempt.attemptNumber),
          String(attempt.score),
          String(attempt.maxScore),
          String(attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0),
          attempt.submittedAt.toISOString(),
        ]),
      );
    }

    attemptCursor = attempts.at(-1)?.id;
    if (attempts.length < pageSize) break;
  }

  return csv.chunks.join("\n");
}

function shortError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/[\r\n]+/g, " ").slice(0, 300) || fallback;
}

function encodedLengthForBytes(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

export async function buildBackupJson(options: ExportBuildOptions = {}) {
  const maxOutputBytes = outputLimit(options, ADMIN_EXPORT_LIMITS.backupOutputBytes);
  const [problemSetRecords, totalProblems, importedFiles] = await Promise.all([
    prisma.problemSet.findMany({
      orderBy: { createdAt: "asc" },
      take: ADMIN_EXPORT_LIMITS.backupProblemSetCount + 1,
      select: {
        id: true,
        title: true,
        order: true,
        createdAt: true,
      },
    }),
    prisma.problem.count(),
    prisma.importedFile.findMany({
      orderBy: { createdAt: "asc" },
      take: ADMIN_EXPORT_LIMITS.backupFileCount + 1,
      select: {
        id: true,
        storageKey: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        checksum: true,
        createdAt: true,
        problemFileFor: { select: { slug: true } },
        solutionFileFor: { select: { slug: true } },
        _count: { select: { assetFor: true, writeupImageFor: true } },
      },
    }),
  ]);

  if (problemSetRecords.length > ADMIN_EXPORT_LIMITS.backupProblemSetCount) {
    throw new AdminExportLimitError(
      `Backup exceeds the ${ADMIN_EXPORT_LIMITS.backupProblemSetCount} problem-set limit.`,
    );
  }
  if (importedFiles.length > ADMIN_EXPORT_LIMITS.backupFileCount) {
    throw new AdminExportLimitError(
      `Backup exceeds the ${ADMIN_EXPORT_LIMITS.backupFileCount} file limit.`,
    );
  }
  if (totalProblems > ADMIN_EXPORT_LIMITS.backupProblemCount) {
    throw new AdminExportLimitError(
      `Backup exceeds the ${ADMIN_EXPORT_LIMITS.backupProblemCount} problem limit.`,
    );
  }

  const problemSetBackups: Array<ReturnType<typeof problemSetToImportJson>> = [];
  let problemSetBytes = 0;
  let observedProblems = 0;
  for (const record of problemSetRecords.sort(compareProblemSetRecords)) {
    const problemSet = await prisma.problemSet.findUnique({
      where: { id: record.id },
      select: {
        slug: true,
        title: true,
        description: true,
        order: true,
        status: true,
        visibleFrom: true,
        visibleTo: true,
        topicTags: true,
        difficulty: true,
        videoUrl: true,
        problems: {
          orderBy: { number: "asc" },
          take: ADMIN_EXPORT_LIMITS.backupProblemCount + 1,
          select: {
            number: true,
            statement: true,
            contentFormat: true,
            answerKey: true,
            answerType: true,
            acceptedAnswers: true,
            caseSensitive: true,
            topicTags: true,
            points: true,
            explanationNote: true,
          },
        },
      },
    });
    if (!problemSet) throw new Error("Problem-set data changed while the backup was generated.");
    observedProblems += problemSet.problems.length;
    if (observedProblems > ADMIN_EXPORT_LIMITS.backupProblemCount) {
      throw new AdminExportLimitError(
        `Backup exceeds the ${ADMIN_EXPORT_LIMITS.backupProblemCount} problem limit.`,
      );
    }

    const backup = problemSetToImportJson(problemSet);
    const bytes = Buffer.byteLength(JSON.stringify(backup), "utf8");
    if (bytes > ADMIN_EXPORT_LIMITS.backupProblemSetBytes) {
      throw new AdminExportLimitError(
        `Problem set "${backup.slug}" exceeds the per-set backup limit.`,
      );
    }
    problemSetBytes += bytes;
    if (problemSetBytes > ADMIN_EXPORT_LIMITS.backupProblemSetsBytes) {
      throw new AdminExportLimitError("Problem-set data exceeds the aggregate backup limit.");
    }
    problemSetBackups.push(backup);
  }

  const importedFileBackups: Array<Record<string, unknown>> = [];
  const failedFiles: Array<{ storageKey: string; error: string }> = [];
  const unsupportedFileRelations: Array<{ storageKey: string; relations: string[] }> = [];
  let decodedBytes = 0;
  let encodedBytes = 0;
  const effectiveEncodedLimit = Math.min(
    ADMIN_EXPORT_LIMITS.backupEncodedBytes,
    Math.max(0, maxOutputBytes - problemSetBytes),
  );

  // Intentionally sequential: at most one decoded file buffer is resident here.
  for (const file of importedFiles) {
    const unsupportedRelations: string[] = [];
    if (file._count.assetFor > 0) {
      unsupportedRelations.push(`problem-set-assets:${file._count.assetFor}`);
    }
    if (file._count.writeupImageFor > 0) {
      unsupportedRelations.push(`writeup-images:${file._count.writeupImageFor}`);
    }
    if (unsupportedRelations.length > 0) {
      unsupportedFileRelations.push({
        storageKey: file.storageKey,
        relations: unsupportedRelations,
      });
    }

    const relations = {
      problemFileFor: file.problemFileFor.map((set) => set.slug),
      solutionFileFor: file.solutionFileFor.map((set) => set.slug),
      unsupportedRelations,
    };
    const fileBackup: Record<string, unknown> = {
      id: file.id,
      storageKey: file.storageKey,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksum: file.checksum,
      createdAt: file.createdAt.toISOString(),
      relations,
      dataBase64: null,
    };

    let failure: string | null = null;
    if (relations.problemFileFor.length + relations.solutionFileFor.length === 0) {
      failure = "File has no restorable problem/solution association; contents were omitted.";
    } else if (
      relations.problemFileFor.length + relations.solutionFileFor.length >
      ADMIN_EXPORT_LIMITS.fileRelationTargets
    ) {
      failure = "File has too many problem/solution relation targets.";
    } else if (
      !Number.isSafeInteger(file.sizeBytes) ||
      file.sizeBytes < 0 ||
      file.sizeBytes > ADMIN_EXPORT_LIMITS.backupFileDecodedBytes
    ) {
      failure = "File size metadata exceeds the per-file backup limit.";
    } else {
      const expectedEncodedBytes = encodedLengthForBytes(file.sizeBytes);
      if (decodedBytes + file.sizeBytes > ADMIN_EXPORT_LIMITS.backupDecodedBytes) {
        failure = "File would exceed the aggregate decoded backup limit.";
      } else if (encodedBytes + expectedEncodedBytes > effectiveEncodedLimit) {
        failure = "File would exceed the aggregate encoded backup limit.";
      }
    }

    if (!failure) {
      try {
        const buffer = await readFileBufferBounded(
          file.storageKey,
          Math.min(
            ADMIN_EXPORT_LIMITS.backupFileDecodedBytes,
            ADMIN_EXPORT_LIMITS.backupDecodedBytes - decodedBytes,
          ),
        );
        const actualChecksum = createHash("sha256").update(buffer).digest("hex");
        if (buffer.byteLength !== file.sizeBytes) {
          failure = "Stored file size does not match its database metadata.";
        } else if (actualChecksum !== file.checksum.trim().toLowerCase()) {
          failure = "Stored file checksum does not match its database metadata.";
        } else {
          const dataBase64 = buffer.toString("base64");
          const actualEncodedBytes = Buffer.byteLength(dataBase64, "ascii");
          if (encodedBytes + actualEncodedBytes > effectiveEncodedLimit) {
            failure = "File would exceed the aggregate encoded backup limit.";
          } else {
            decodedBytes += buffer.byteLength;
            encodedBytes += actualEncodedBytes;
            fileBackup.dataBase64 = dataBase64;
          }
        }
      } catch (error) {
        failure = shortError(error, "Stored file could not be read.");
      }
    }

    if (failure) {
      fileBackup.backupError = failure;
      failedFiles.push({ storageKey: file.storageKey, error: failure });
    }
    importedFileBackups.push(fileBackup);
  }

  const json = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schema: "dbsmo-backup-v1",
      problemSets: problemSetBackups,
      importedFiles: importedFileBackups,
      failedFiles,
      unsupportedFileRelations,
    },
    null,
    2,
  );
  if (Buffer.byteLength(json, "utf8") > maxOutputBytes) {
    throw new AdminExportLimitError("Backup exceeds the configured output limit.");
  }

  return json;
}
