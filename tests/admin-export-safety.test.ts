import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decodeVerifiedBackupFile,
  extractStoredExportContent,
  inspectBackupFileContent,
  parseBackupFileRelations,
  safeAttachmentFileName,
  validateBackupStorageKey,
} from "../lib/admin-export-safety";

function fileContent(value: string) {
  const buffer = Buffer.from(value);
  return {
    checksum: createHash("sha256").update(buffer).digest("hex"),
    dataBase64: buffer.toString("base64"),
    sizeBytes: buffer.byteLength,
  };
}

describe("backup file content validation", () => {
  it("inspects and verifies a valid file", () => {
    const inspected = inspectBackupFileContent(fileContent("hello"), {
      maxDecodedBytes: 100,
      maxEncodedBytes: 100,
    });

    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.content).toMatchObject({ decodedBytes: 5, encodedBytes: 8 });
    expect(decodeVerifiedBackupFile(inspected.content)).toEqual({
      ok: true,
      buffer: Buffer.from("hello"),
    });
  });

  it("rejects non-canonical base64 instead of relying on Buffer's lenient decoder", () => {
    expect(
      inspectBackupFileContent(
        { checksum: "0".repeat(64), dataBase64: "aGVsbG8", sizeBytes: 5 },
        { maxDecodedBytes: 100, maxEncodedBytes: 100 },
      ),
    ).toEqual({ ok: false, error: "File content is not valid canonical base64." });
  });

  it("rejects declared sizes that do not match decoded content", () => {
    const input = { ...fileContent("hello"), sizeBytes: 4 };
    expect(inspectBackupFileContent(input, { maxDecodedBytes: 100, maxEncodedBytes: 100 })).toEqual(
      { ok: false, error: "File size does not match the decoded content." },
    );
  });

  it("enforces remaining aggregate encoded and decoded budgets before decoding", () => {
    const input = fileContent("hello");
    expect(inspectBackupFileContent(input, { maxDecodedBytes: 100, maxEncodedBytes: 7 })).toEqual({
      ok: false,
      error: "File content exceeds the aggregate encoded limit.",
    });
    expect(inspectBackupFileContent(input, { maxDecodedBytes: 4, maxEncodedBytes: 100 })).toEqual({
      ok: false,
      error: "File content exceeds the aggregate decoded limit.",
    });
  });

  it("verifies the checksum against actual decoded bytes", () => {
    const inspected = inspectBackupFileContent(
      { ...fileContent("hello"), checksum: "0".repeat(64) },
      { maxDecodedBytes: 100, maxEncodedBytes: 100 },
    );
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(decodeVerifiedBackupFile(inspected.content)).toEqual({
      ok: false,
      error: "File checksum does not match the decoded content.",
    });
  });
});

describe("backup file association validation", () => {
  it("parses supported links and reports additive unsupported relation metadata", () => {
    expect(
      parseBackupFileRelations({
        problemFileFor: ["set-one", "set-one"],
        solutionFileFor: ["set-two"],
        unsupportedRelations: ["problem-set-assets:2"],
      }),
    ).toEqual({
      ok: true,
      relations: {
        problemFileFor: ["set-one"],
        solutionFileFor: ["set-two"],
        unsupportedRelations: ["problem-set-assets:2"],
      },
    });
  });

  it("rejects legacy files without association metadata", () => {
    expect(parseBackupFileRelations(undefined)).toEqual({
      ok: false,
      error:
        "File relation metadata is missing; legacy unassociated files cannot be restored safely.",
    });
  });

  it("rejects path-traversal storage keys", () => {
    expect(validateBackupStorageKey("imports/set/file.pdf")).toBe("imports/set/file.pdf");
    expect(validateBackupStorageKey("../secret")).toBeNull();
    expect(validateBackupStorageKey("/absolute/file")).toBeNull();
    expect(validateBackupStorageKey("bad\0key")).toBeNull();
  });
});

describe("stored export response safety", () => {
  it("requires a bounded string content field", () => {
    expect(extractStoredExportContent({ content: "ok" }, 2)).toEqual({
      ok: true,
      content: "ok",
    });
    expect(extractStoredExportContent({ content: "é" }, 1)).toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(extractStoredExportContent({ content: { nested: true } }, 100)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("removes header control characters from attachment names", () => {
    const name = safeAttachmentFileName('report"\r\nX-Test: yes.json', "export.txt");
    expect(name).not.toMatch(/["\r\n]/);
    expect(name.endsWith(".json")).toBe(true);
  });
});
