import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  announcementCreate: vi.fn(),
  announcementDeleteMany: vi.fn(),
  announcementFindUnique: vi.fn(),
  cleanupStoredWriteupImages: vi.fn(),
  cleanupUnreferencedImportedFiles: vi.fn(),
  getServerSession: vi.fn(),
  prepareWriteupImages: vi.fn(),
  problemSetFindUnique: vi.fn(),
  transaction: vi.fn(),
  transactionAnnouncementCreate: vi.fn(),
  transactionClassFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  writeupCreate: vi.fn(),
  writeupDelete: vi.fn(),
  writeupDeleteMany: vi.fn(),
  writeupFindUnique: vi.fn(),
  writeupVoteAggregate: vi.fn(),
  writeupVoteDeleteMany: vi.fn(),
  writeupVoteFindUnique: vi.fn(),
  writeupVoteUpsert: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/imported-file-cleanup", () => ({
  cleanupUnreferencedImportedFiles: mocks.cleanupUnreferencedImportedFiles,
}));

vi.mock("@/lib/writeup-images", () => ({
  cleanupStoredWriteupImages: mocks.cleanupStoredWriteupImages,
  MAX_WRITEUP_IMAGE_TOTAL_BYTES: 20 * 1024 * 1024,
  prepareWriteupImages: mocks.prepareWriteupImages,
  storePreparedWriteupImage: vi.fn(),
  WriteupImageValidationError: class WriteupImageValidationError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    announcement: {
      create: mocks.announcementCreate,
      deleteMany: mocks.announcementDeleteMany,
      findUnique: mocks.announcementFindUnique,
    },
    problemSet: { findUnique: mocks.problemSetFindUnique },
    user: { findUnique: mocks.userFindUnique },
    writeup: {
      create: mocks.writeupCreate,
      delete: mocks.writeupDelete,
      deleteMany: mocks.writeupDeleteMany,
      findUnique: mocks.writeupFindUnique,
    },
    writeupVote: {
      aggregate: mocks.writeupVoteAggregate,
      deleteMany: mocks.writeupVoteDeleteMany,
      findUnique: mocks.writeupVoteFindUnique,
      upsert: mocks.writeupVoteUpsert,
    },
  },
}));

import { POST as createWriteup } from "@/app/api/problem-sets/[id]/writeups/route";
import { DELETE as deleteWriteup } from "@/app/api/writeups/[id]/route";
import { POST as voteOnWriteup } from "@/app/api/writeups/[id]/vote/route";
import { POST as createAnnouncement } from "@/app/api/admin/announcements/route";
import { DELETE as deleteAnnouncement } from "@/app/api/admin/announcements/[id]/route";

const visibleSet = {
  id: "set-1",
  status: "PUBLISHED" as const,
  visibleFrom: null,
  visibleTo: null,
};

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://dbsmo.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

function prismaError(code: string) {
  return { name: "PrismaClientKnownRequestError", code };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getServerSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.userFindUnique.mockResolvedValue({ id: "user-1", role: "STUDENT" });
  mocks.problemSetFindUnique.mockResolvedValue(visibleSet);
  mocks.prepareWriteupImages.mockResolvedValue([]);
  mocks.writeupCreate.mockResolvedValue({ id: "writeup-1" });
  mocks.writeupDelete.mockResolvedValue({ id: "writeup-1" });
  mocks.writeupDeleteMany.mockResolvedValue({ count: 1 });
  mocks.writeupVoteAggregate.mockResolvedValue({ _sum: { value: 1 } });
  mocks.writeupVoteFindUnique.mockResolvedValue({ value: 1 });
  mocks.writeupVoteUpsert.mockResolvedValue({ id: "vote-1" });
  mocks.announcementDeleteMany.mockResolvedValue({ count: 1 });
  mocks.cleanupUnreferencedImportedFiles.mockResolvedValue({
    deletedIds: [],
    failedStorageKeys: [],
  });
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      announcement: { create: mocks.transactionAnnouncementCreate },
      class: { findMany: mocks.transactionClassFindMany },
    }),
  );
  mocks.transactionAnnouncementCreate.mockResolvedValue({ id: "announcement-1" });
  mocks.transactionClassFindMany.mockResolvedValue([{ id: "class-1" }]);
});

describe("community API cross-site protections", () => {
  it("rejects cross-site mutations before authentication or database work", async () => {
    const request = (path: string, method: string) =>
      new Request(`https://dbsmo.example${path}`, {
        method,
        headers: { "Sec-Fetch-Site": "cross-site" },
      });

    const responses = await Promise.all([
      createWriteup(request("/api/problem-sets/set-1/writeups", "POST"), context("set-1")),
      voteOnWriteup(request("/api/writeups/writeup-1/vote", "POST"), context("writeup-1")),
      deleteWriteup(request("/api/writeups/writeup-1", "DELETE"), context("writeup-1")),
      createAnnouncement(request("/api/admin/announcements", "POST")),
      deleteAnnouncement(
        request("/api/admin/announcements/announcement-1", "DELETE"),
        context("announcement-1"),
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403]);
    expect(mocks.getServerSession).not.toHaveBeenCalled();
  });
});

describe("writeup route integrity", () => {
  it("rejects overlong titles instead of silently truncating persisted text", async () => {
    const form = new FormData();
    form.set("title", "x".repeat(121));
    form.set("body", "Proof");
    form.set("contentFormat", "LATEX");

    const response = await createWriteup(
      new Request("https://dbsmo.example/api/problem-sets/set-1/writeups", {
        method: "POST",
        headers: { "Sec-Fetch-Site": "same-origin" },
        body: form,
      }),
      context("set-1"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Writeup title is too long." });
    expect(mocks.writeupCreate).not.toHaveBeenCalled();
  });

  it("rejects file-valued text fields instead of coercing them into post content", async () => {
    const form = new FormData();
    form.set("title", new File(["not a title"], "title.txt", { type: "text/plain" }));
    form.set("body", "Proof");
    form.set("contentFormat", "LATEX");

    const response = await createWriteup(
      new Request("https://dbsmo.example/api/problem-sets/set-1/writeups", {
        method: "POST",
        headers: { "Sec-Fetch-Site": "same-origin" },
        body: form,
      }),
      context("set-1"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid writeup fields." });
    expect(mocks.writeupCreate).not.toHaveBeenCalled();
  });

  it("lets an author delete their own writeup after its set becomes hidden", async () => {
    mocks.writeupFindUnique.mockResolvedValue({
      id: "writeup-1",
      authorId: "user-1",
      problemSet: { ...visibleSet, status: "ARCHIVED" },
      images: [{ file: { id: "file-1" } }],
    });

    const response = await deleteWriteup(
      new Request("https://dbsmo.example/api/writeups/writeup-1", {
        method: "DELETE",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      context("writeup-1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.writeupDeleteMany).toHaveBeenCalledWith({
      where: { id: "writeup-1", authorId: "user-1" },
    });
    expect(mocks.cleanupUnreferencedImportedFiles).toHaveBeenCalledWith(["file-1"]);
  });

  it("hides an archived writeup from a non-author", async () => {
    mocks.writeupFindUnique.mockResolvedValue({
      id: "writeup-1",
      authorId: "other-user",
      problemSet: { ...visibleSet, status: "ARCHIVED" },
      images: [],
    });

    const response = await deleteWriteup(
      new Request("https://dbsmo.example/api/writeups/writeup-1", {
        method: "DELETE",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      context("writeup-1"),
    );

    expect(response.status).toBe(404);
    expect(mocks.writeupDeleteMany).not.toHaveBeenCalled();
  });

  it("handles a concurrent writeup deletion without throwing", async () => {
    mocks.writeupFindUnique.mockResolvedValue({
      id: "writeup-1",
      authorId: "user-1",
      problemSet: visibleSet,
      images: [{ file: { id: "file-1" } }],
    });
    mocks.writeupDeleteMany.mockResolvedValue({ count: 0 });

    const response = await deleteWriteup(
      new Request("https://dbsmo.example/api/writeups/writeup-1", {
        method: "DELETE",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      context("writeup-1"),
    );

    expect(response.status).toBe(404);
    expect(mocks.cleanupUnreferencedImportedFiles).not.toHaveBeenCalled();
  });

  it("returns not found when a writeup disappears while a vote is being saved", async () => {
    mocks.writeupFindUnique.mockResolvedValue({
      id: "writeup-1",
      problemSet: visibleSet,
    });
    mocks.writeupVoteUpsert.mockRejectedValue(prismaError("P2003"));

    const response = await voteOnWriteup(
      jsonRequest("/api/writeups/writeup-1/vote", { value: 1 }),
      context("writeup-1"),
    );

    expect(response.status).toBe(404);
    expect(mocks.writeupVoteAggregate).not.toHaveBeenCalled();
  });

  it("rejects an oversized vote body before parsing it", async () => {
    mocks.writeupFindUnique.mockResolvedValue({
      id: "writeup-1",
      problemSet: visibleSet,
    });

    const response = await voteOnWriteup(
      jsonRequest("/api/writeups/writeup-1/vote", { value: "x".repeat(2_000) }),
      context("writeup-1"),
    );

    expect(response.status).toBe(413);
    expect(mocks.writeupVoteUpsert).not.toHaveBeenCalled();
  });
});

describe("announcement authorization and races", () => {
  it("rejects an oversized announcement body before validation or persistence", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });

    const response = await createAnnouncement(
      jsonRequest("/api/admin/announcements", {
        title: "Reminder",
        body: "x".repeat(33_000),
        classIds: ["class-1"],
      }),
    );

    expect(response.status).toBe(413);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("checks every selected class inside the transaction against the teacher", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });
    mocks.transactionClassFindMany.mockResolvedValue([{ id: "class-1" }]);

    const response = await createAnnouncement(
      jsonRequest("/api/admin/announcements", {
        title: "Reminder",
        body: "Bring your notes.",
        classIds: ["class-1", "class-2"],
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.transactionClassFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["class-1", "class-2"] },
        teacherId: "teacher-1",
      },
      select: { id: true },
    });
    expect(mocks.transactionAnnouncementCreate).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("returns a conflict when selected classes change during creation", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });
    mocks.transaction.mockRejectedValue(prismaError("P2034"));

    const response = await createAnnouncement(
      jsonRequest("/api/admin/announcements", {
        title: "Reminder",
        body: "Bring your notes.",
        classIds: ["class-1"],
      }),
    );

    expect(response.status).toBe(409);
  });

  it("handles a concurrent announcement deletion without throwing", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });
    mocks.announcementFindUnique.mockResolvedValue({
      id: "announcement-1",
      createdById: "teacher-1",
    });
    mocks.announcementDeleteMany.mockResolvedValue({ count: 0 });

    const response = await deleteAnnouncement(
      new Request("https://dbsmo.example/api/admin/announcements/announcement-1", {
        method: "DELETE",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      context("announcement-1"),
    );

    expect(response.status).toBe(404);
  });
});
