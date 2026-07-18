import type JSZip from "jszip";

type StreamableZipEntry = JSZip.JSZipObject & {
  internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array>;
};

export class ClientZipExpandedSizeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientZipExpandedSizeLimitError";
  }
}

/** Inflate a browser-side JSZip entry without first materializing unbounded output. */
export function readClientZipEntryBounded(
  entry: JSZip.JSZipObject,
  maxBytes: number,
  limitMessage: string,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    return Promise.reject(new ClientZipExpandedSizeLimitError(limitMessage));
  }

  return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const stream = (entry as StreamableZipEntry).internalStream("uint8array");
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      stream.pause();
      reject(error);
    };

    stream.on("data", (chunk) => {
      if (settled) return;
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        fail(new ClientZipExpandedSizeLimitError(limitMessage));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", fail);
    stream.on("end", () => {
      if (settled) return;
      settled = true;
      const output = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(output);
    });
    stream.resume();
  });
}
