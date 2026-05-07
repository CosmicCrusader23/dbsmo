import { prisma } from "@/lib/db";
import { computeBestAverageScore, toCsvRow } from "@/lib/analytics";
import { problemSetToImportJson } from "@/lib/import/problem-set-json-export";
import { readFileBuffer } from "@/lib/storage";
import { compareProblemSetRecords } from "@/lib/problem-set-order";

export async function buildStudentsCsv() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: {
      attempts: { select: { score: true, maxScore: true, problemSetId: true } },
    },
    orderBy: { name: "asc" },
  });

  const header = toCsvRow([
    "Name",
    "Email",
    "Group",
    "Sets Attempted",
    "Average Score %",
    "Total Attempts",
  ]);
  const rows = students.map((student) => {
    const sets = new Set(student.attempts.map((attempt) => attempt.problemSetId));
    const avg = computeBestAverageScore(student.attempts);
    return toCsvRow([
      student.name ?? "",
      student.email,
      student.group ?? "",
      String(sets.size),
      String(avg),
      String(student.attempts.length),
    ]);
  });

  return [header, ...rows].join("\n");
}

export async function buildAttemptsCsv() {
  const attempts = await prisma.attempt.findMany({
    include: {
      user: { select: { name: true, email: true } },
      problemSet: { select: { title: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

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
  const rows = attempts.map((attempt) =>
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

  return [header, ...rows].join("\n");
}

export async function buildBackupJson() {
  const [problemSets, importedFiles] = await Promise.all([
    prisma.problemSet.findMany({
      orderBy: { createdAt: "asc" },
      include: { problems: { orderBy: { number: "asc" } } },
    }),
    prisma.importedFile.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        storageKey: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        checksum: true,
        createdAt: true,
      },
    }),
  ]);

  const importedFileBackups = await Promise.all(
    importedFiles.map(async (file) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
      dataBase64: await readFileBuffer(file.storageKey)
        .then((buffer) => buffer.toString("base64"))
        .catch(() => null),
    })),
  );

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schema: "dbsmo-backup-v1",
      problemSets: problemSets.sort(compareProblemSetRecords).map(problemSetToImportJson),
      importedFiles: importedFileBackups,
    },
    null,
    2,
  );
}
