import { createHash, createHmac } from "node:crypto";
import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

type StorageDriver = "local" | "s3";

export class StorageReadLimitError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Stored file exceeds the ${maxBytes}-byte read limit.`);
    this.name = "StorageReadLimitError";
  }
}

const root = resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.LOCAL_STORAGE_ROOT ?? "./storage",
);

export function resolveStorageDriver(value: string | undefined): StorageDriver {
  const normalized = value?.trim().toLowerCase() || "local";
  if (normalized === "local" || normalized === "s3") return normalized;
  throw new Error('STORAGE_DRIVER must be either "local" or "s3".');
}

const storageDriver = resolveStorageDriver(process.env.STORAGE_DRIVER);

function assertLocalStorageDriver() {
  if (storageDriver !== "local") {
    throw new Error(`Unsupported storage driver: ${storageDriver}`);
  }
}

function assertValidStorageKey(key: string) {
  if (!key || key.includes("\0")) {
    throw new Error("Invalid storage key.");
  }

  if (key.startsWith("/") || key.split("/").includes("..")) {
    throw new Error("Storage key must stay inside the storage root.");
  }
}

function s3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
  };
}

function hashHex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function signingKey(secretAccessKey: string, date: string, region: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function encodeS3Path(value: string) {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function s3Request(method: "DELETE" | "GET" | "PUT", key: string, body?: Buffer) {
  assertValidStorageKey(key);
  const config = s3Config();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const url = new URL(
    `${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodeS3Path(key)}`,
  );
  const payloadHash = hashHex(body ?? "");
  const host = url.host;
  const canonicalUri = url.pathname;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    signingKey(config.secretAccessKey, dateStamp, config.region),
  )
    .update(stringToSign)
    .digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method,
    body: body ? new Uint8Array(body) : undefined,
    headers: {
      Authorization: authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  });

  if (!response.ok && !(method === "DELETE" && response.status === 404)) {
    throw new Error(`S3 ${method} failed for ${key}: ${response.status}`);
  }

  return response;
}

function resolveStoragePath(key: string): string {
  assertValidStorageKey(key);

  const dest = resolve(/*turbopackIgnore: true*/ root, key);
  const relativePath = relative(root, dest);

  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Storage key must stay inside the storage root.");
  }

  return dest;
}

/**
 * Persist a file buffer to local disk under the given storage key.
 * Creates parent directories if they don't exist.
 */
export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  if (storageDriver === "s3") {
    await s3Request("PUT", key, buffer);
    return;
  }

  const dest = resolveStoragePath(key);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
}

/** Return the absolute filesystem path for a storage key. */
export function getFilePath(key: string): string {
  assertLocalStorageDriver();
  return resolveStoragePath(key);
}

/**
 * Read a stored object without trusting database size metadata. Both local and
 * S3 paths enforce the cap against bytes from the storage backend.
 */
export async function readFileBufferBounded(key: string, maxBytes: number): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("Storage read limit must be a non-negative safe integer.");
  }

  if (storageDriver === "s3") {
    const response = await s3Request("GET", key);
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null) {
      const parsedLength = Number(declaredLength);
      if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
        await response.body?.cancel().catch(() => undefined);
        throw new StorageReadLimitError(maxBytes);
      }
    }

    if (!response.body) return Buffer.alloc(0);
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new StorageReadLimitError(maxBytes);
      }
      chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, totalBytes);
  }

  const handle = await open(resolveStoragePath(key), "r");
  try {
    const fileStats = await handle.stat();
    if (!Number.isSafeInteger(fileStats.size) || fileStats.size > maxBytes) {
      throw new StorageReadLimitError(maxBytes);
    }

    const buffer = Buffer.alloc(fileStats.size);
    let totalBytes = 0;
    while (totalBytes < buffer.byteLength) {
      const { bytesRead } = await handle.read(
        buffer,
        totalBytes,
        buffer.byteLength - totalBytes,
        totalBytes,
      );
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
    }

    const probe = Buffer.allocUnsafe(1);
    const { bytesRead: extraBytes } = await handle.read(probe, 0, 1, totalBytes);
    if (extraBytes > 0) {
      throw new StorageReadLimitError(maxBytes);
    }

    return buffer.subarray(0, totalBytes);
  } finally {
    await handle.close();
  }
}

/** Remove a stored file. Silently succeeds if the file doesn't exist. */
export async function deleteFile(key: string): Promise<void> {
  if (storageDriver === "s3") {
    await s3Request("DELETE", key);
    return;
  }

  await rm(resolveStoragePath(key), { force: true });
}
