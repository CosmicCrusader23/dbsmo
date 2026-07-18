import type JSZip from "jszip";

type SizedZipEntry = JSZip.JSZipObject & {
  _data?: {
    uncompressedSize?: unknown;
  };
};

type DestroyableReadable = NodeJS.ReadableStream & {
  destroy(error?: Error): void;
};

export class ZipExpandedSizeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipExpandedSizeLimitError";
  }
}

/** Read JSZip central-directory size metadata without trusting it as a hard limit. */
export function declaredZipEntrySize(
  entry: JSZip.JSZipObject,
): { kind: "unknown" } | { kind: "invalid" } | { kind: "known"; bytes: number } {
  const value = (entry as SizedZipEntry)._data?.uncompressedSize;
  if (value === undefined) return { kind: "unknown" };
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return { kind: "invalid" };
  }
  return { kind: "known", bytes: value };
}

/**
 * Inflate one ZIP entry into bounded chunks. This is the authoritative backstop
 * when central-directory metadata is absent, corrupt, or dishonest.
 */
export function readZipEntryBufferBounded(
  entry: JSZip.JSZipObject,
  maxBytes: number,
  limitMessage: string,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    return Promise.reject(new ZipExpandedSizeLimitError(limitMessage));
  }

  return new Promise((resolve, reject) => {
    let stream: DestroyableReadable;
    try {
      stream = entry.nodeStream("nodebuffer") as DestroyableReadable;
    } catch (error) {
      reject(error);
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      stream.destroy();
      reject(error);
    };

    stream.on("data", (chunk: Buffer | Uint8Array | string) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > maxBytes) {
        fail(new ZipExpandedSizeLimitError(limitMessage));
        return;
      }
      chunks.push(buffer);
    });
    stream.once("error", fail);
    stream.once("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, totalBytes));
    });
    stream.once("close", () => {
      if (!settled) fail(new Error("ZIP entry stream closed before completion."));
    });
  });
}

export async function readZipEntryTextBounded(
  entry: JSZip.JSZipObject,
  maxBytes: number,
  limitMessage: string,
): Promise<string> {
  const buffer = await readZipEntryBufferBounded(entry, maxBytes, limitMessage);
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}
