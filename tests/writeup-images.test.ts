import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupStoredWriteupImages,
  MAX_WRITEUP_IMAGE_BYTES,
  MAX_WRITEUP_IMAGE_TOTAL_BYTES,
  MAX_WRITEUP_IMAGES,
  prepareWriteupImages,
  storePreparedWriteupImage,
  validateWriteupImageDeclarations,
} from "../lib/writeup-images";

type MockTransactionClient = {
  importedFile: { create: ReturnType<typeof vi.fn> };
  writeupImage: { create: ReturnType<typeof vi.fn> };
};

const persistence = vi.hoisted(() => {
  const importedFileCreate = vi.fn();
  const writeupImageCreate = vi.fn();
  return {
    deleteFile: vi.fn(),
    importedFileCreate,
    importedFileDelete: vi.fn(),
    saveFile: vi.fn(),
    transaction: vi.fn(async (callback: (tx: MockTransactionClient) => Promise<unknown>) =>
      callback({
        importedFile: { create: importedFileCreate },
        writeupImage: { create: writeupImageCreate },
      }),
    ),
    writeupImageCreate,
  };
});

vi.mock("@/lib/storage", () => ({
  deleteFile: persistence.deleteFile,
  saveFile: persistence.saveFile,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: persistence.transaction,
    importedFile: { delete: persistence.importedFileDelete },
  },
}));

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

beforeEach(() => {
  vi.clearAllMocks();
  persistence.deleteFile.mockResolvedValue(undefined);
  persistence.importedFileCreate.mockResolvedValue({ id: "file-1" });
  persistence.importedFileDelete.mockResolvedValue({ id: "deleted" });
  persistence.saveFile.mockResolvedValue(undefined);
  persistence.writeupImageCreate.mockResolvedValue({ id: "link-1" });
});

describe("writeup image validation", () => {
  it("rejects over-count and over-aggregate batches from declarations", () => {
    const tooMany = Array.from({ length: MAX_WRITEUP_IMAGES + 1 }, (_, index) => ({
      name: `image-${index}.png`,
      size: MAX_WRITEUP_IMAGE_BYTES,
      type: "image/png",
    }));

    const errors = validateWriteupImageDeclarations(tooMany);

    expect(errors).toContain(`Upload at most ${MAX_WRITEUP_IMAGES} images.`);
    expect(errors).toContain(
      `Writeup images must total ${MAX_WRITEUP_IMAGE_TOTAL_BYTES / 1024 / 1024} MB or less.`,
    );
  });

  it("rejects invalid sizes and declared MIME types before reading bytes", async () => {
    const file = new File([Buffer.from([0])], "avatar.bmp", { type: "image/bmp" });
    const arrayBuffer = vi.spyOn(file, "arrayBuffer");

    await expect(prepareWriteupImages([file])).rejects.toThrow(
      "avatar.bmp must be PNG, JPEG, GIF, or WebP.",
    );
    expect(arrayBuffer).not.toHaveBeenCalled();

    expect(
      validateWriteupImageDeclarations([{ name: "empty.png", size: 0, type: "image/png" }]),
    ).toContain("empty.png is empty or has an invalid size.");
  });

  it("rejects bytes whose magic does not match the declared image MIME", async () => {
    const file = new File([Buffer.from("not a png")], "fake.png", { type: "image/png" });

    await expect(prepareWriteupImages([file])).rejects.toThrow(
      "fake.png bytes do not match the declared image/png image type.",
    );
  });

  it("prepares a valid image with normalized metadata", async () => {
    const file = new File([PNG_1X1], "diagram.png", { type: "image/png" });

    const [prepared] = await prepareWriteupImages([file]);

    expect(prepared).toEqual(
      expect.objectContaining({
        fileName: "diagram.png",
        mimeType: "image/png",
        sizeBytes: PNG_1X1.byteLength,
      }),
    );
    expect(prepared.buffer.equals(PNG_1X1)).toBe(true);
    expect(prepared.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("removes staged storage when the metadata transaction fails", async () => {
    const [image] = await prepareWriteupImages([
      new File([PNG_1X1], "diagram.png", { type: "image/png" }),
    ]);
    persistence.writeupImageCreate.mockRejectedValueOnce(new Error("link failed"));

    await expect(
      storePreparedWriteupImage({
        image,
        problemSetId: "set-1",
        writeupId: "writeup-1",
        uploadedById: "user-1",
        sortOrder: 0,
      }),
    ).rejects.toThrow("link failed");

    expect(persistence.saveFile).toHaveBeenCalledOnce();
    expect(persistence.deleteFile).toHaveBeenCalledWith(
      expect.stringMatching(/^writeups\/set-1\/writeup-1\//),
    );
  });

  it("compensates completed metadata rows and storage in reverse order", async () => {
    await cleanupStoredWriteupImages([
      { fileId: "file-1", storageKey: "writeups/set/writeup/one.png" },
      { fileId: "file-2", storageKey: "writeups/set/writeup/two.png" },
    ]);

    expect(persistence.importedFileDelete.mock.calls.map(([arg]) => arg.where.id)).toEqual([
      "file-2",
      "file-1",
    ]);
    expect(persistence.deleteFile.mock.calls.map(([key]) => key)).toEqual([
      "writeups/set/writeup/two.png",
      "writeups/set/writeup/one.png",
    ]);
  });
});
