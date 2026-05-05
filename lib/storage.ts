import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

type StorageDriver = "local" | "s3";

const root = resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.LOCAL_STORAGE_ROOT ?? "./storage",
);
const storageDriver = (process.env.STORAGE_DRIVER ?? "local") as StorageDriver;

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

/** Return a stored file as a buffer for either local or object storage. */
export async function readFileBuffer(key: string): Promise<Buffer> {
  if (storageDriver === "s3") {
    const response = await s3Request("GET", key);
    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(resolveStoragePath(key));
}

/** Remove a stored file. Silently succeeds if the file doesn't exist. */
export async function deleteFile(key: string): Promise<void> {
  if (storageDriver === "s3") {
    await s3Request("DELETE", key);
    return;
  }

  await rm(resolveStoragePath(key), { force: true });
}
