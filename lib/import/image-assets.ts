/**
 * Problem-set image assets: helpers for parsing inline JSON image declarations
 * and rewriting `[[img:KEY]]` tokens in statements.
 */

import { z } from "zod";

const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_ASSETS_PER_SET = 50;
export const MAX_TOTAL_IMAGE_BYTES = 100 * 1024 * 1024;
export const MAX_ENCODED_ASSET_CHARS = Math.ceil(MAX_ASSET_BYTES / 3) * 4 + 4;
const ASSET_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const SUPPORTED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const MIME_MAGIC_BYTES: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) =>
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) =>
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61,
  "image/webp": (b) =>
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
};

export const ASSET_TOKEN_REGEX = /\[\[img:([a-z0-9][a-z0-9_-]{0,63})\]\]/g;

export const imageAssetSchema = z.object({
  key: z.string().regex(ASSET_KEY_PATTERN, {
    message: "Image key must be lowercase letters, digits, '-' or '_' (≤64 chars).",
  }),
  mimeType: z.string().refine((v) => SUPPORTED_IMAGE_MIME.has(v), {
    message: "Image mimeType must be one of png/jpeg/gif/webp.",
  }),
  data: z
    .string()
    .min(1, { message: "Image data (base64) is required." })
    .max(MAX_ENCODED_ASSET_CHARS, { message: "Encoded image data exceeds the 4 MB limit." }),
});

export type ImageAssetInput = z.infer<typeof imageAssetSchema>;

export const uploadedImageAssetSchema = z.object({
  key: z.string().regex(ASSET_KEY_PATTERN, {
    message: "Image key must be lowercase letters, digits, '-' or '_' (≤64 chars).",
  }),
  name: z.string().min(1).max(255),
  mimeType: z.string().refine((v) => SUPPORTED_IMAGE_MIME.has(v), {
    message: "Image mimeType must be one of png/jpeg/gif/webp.",
  }),
  dataUrl: z
    .string()
    .min(1)
    .max(MAX_ENCODED_ASSET_CHARS + 64),
});

export type UploadedImageAssetInput = z.infer<typeof uploadedImageAssetSchema>;

export type DecodedAsset = {
  key: string;
  mimeType: string;
  buffer: Buffer;
  sizeBytes: number;
  originalName?: string;
};

export function detectImageMime(buffer: Buffer): string | null {
  for (const [mimeType, check] of Object.entries(MIME_MAGIC_BYTES)) {
    if (check(buffer)) {
      return mimeType;
    }
  }
  return null;
}

function decodeBase64Strict(value: string): Buffer | null {
  if (value.length === 0 || value.length > MAX_ENCODED_ASSET_CHARS) return null;
  if (!/^[a-z0-9+/]+={0,2}$/i.test(value)) return null;

  const buffer = Buffer.from(value, "base64");
  const canonicalInput = value.replace(/=+$/, "");
  const canonicalDecoded = buffer.toString("base64").replace(/=+$/, "");
  return canonicalInput === canonicalDecoded ? buffer : null;
}

export function imageKeyFromFileName(fileName: string): string | null {
  const baseName = fileName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  if (!baseName || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(baseName)) {
    return null;
  }
  return baseName;
}

export function validateDecodedImage(args: {
  key: string;
  mimeType: string;
  buffer: Buffer;
  originalName?: string;
}): { ok: true; asset: DecodedAsset } | { ok: false; error: string } {
  if (!SUPPORTED_IMAGE_MIME.has(args.mimeType)) {
    return {
      ok: false,
      error: `Image ${args.key}: mimeType must be one of png/jpeg/gif/webp.`,
    };
  }
  if (args.buffer.byteLength === 0) {
    return { ok: false, error: `Image ${args.key}: empty after decode.` };
  }
  if (args.buffer.byteLength > MAX_ASSET_BYTES) {
    return {
      ok: false,
      error: `Image ${args.key}: ${(args.buffer.byteLength / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_ASSET_BYTES / 1024 / 1024}MB limit.`,
    };
  }
  const detectedMime = detectImageMime(args.buffer);
  if (detectedMime !== args.mimeType) {
    return {
      ok: false,
      error: `Image ${args.key}: bytes do not match declared mimeType ${args.mimeType}.`,
    };
  }
  return {
    ok: true,
    asset: {
      key: args.key,
      mimeType: args.mimeType,
      buffer: args.buffer,
      sizeBytes: args.buffer.byteLength,
      originalName: args.originalName,
    },
  };
}

export function decodeAssets(assets: ImageAssetInput[]): {
  ok: boolean;
  decoded: DecodedAsset[];
  errors: string[];
} {
  const errors: string[] = [];
  const decoded: DecodedAsset[] = [];
  let totalBytes = 0;

  if (assets.length > MAX_ASSETS_PER_SET) {
    errors.push(`Too many images: ${assets.length}. Maximum is ${MAX_ASSETS_PER_SET}.`);
    return { ok: false, decoded: [], errors };
  }

  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.key)) {
      errors.push(`Duplicate image key: ${asset.key}.`);
      continue;
    }
    seen.add(asset.key);
    const buf = decodeBase64Strict(asset.data);
    if (!buf) {
      errors.push(`Image ${asset.key}: base64 data is invalid or too large.`);
      continue;
    }
    const validated = validateDecodedImage({
      key: asset.key,
      mimeType: asset.mimeType,
      buffer: buf,
    });
    if (!validated.ok) {
      errors.push(validated.error);
      continue;
    }
    totalBytes += validated.asset.sizeBytes;
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      errors.push(
        `Images exceed the ${MAX_TOTAL_IMAGE_BYTES / 1024 / 1024} MB total expanded limit.`,
      );
      break;
    }
    decoded.push(validated.asset);
  }

  return { ok: errors.length === 0, decoded, errors };
}

export function decodeUploadedImageAssets(assets: UploadedImageAssetInput[]): {
  ok: boolean;
  decoded: DecodedAsset[];
  errors: string[];
} {
  const errors: string[] = [];
  const decoded: DecodedAsset[] = [];
  let totalBytes = 0;

  if (assets.length > MAX_ASSETS_PER_SET) {
    errors.push(`Too many images: ${assets.length}. Maximum is ${MAX_ASSETS_PER_SET}.`);
    return { ok: false, decoded: [], errors };
  }

  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.key)) {
      errors.push(`Duplicate image key: ${asset.key}.`);
      continue;
    }
    seen.add(asset.key);

    if (asset.dataUrl.length > MAX_ENCODED_ASSET_CHARS + 64) {
      errors.push(`Image ${asset.key}: encoded upload exceeds the 4 MB limit.`);
      continue;
    }
    const match = asset.dataUrl.match(/^data:([^;,]+);base64,([a-z0-9+/]+={0,2})$/i);
    if (!match) {
      errors.push(`Image ${asset.key}: upload data must be a base64 data URL.`);
      continue;
    }
    const [, declaredMime, base64] = match;
    if (declaredMime !== asset.mimeType) {
      errors.push(`Image ${asset.key}: data URL mimeType does not match ${asset.mimeType}.`);
      continue;
    }

    const buffer = decodeBase64Strict(base64);
    if (!buffer) {
      errors.push(`Image ${asset.key}: base64 data is invalid or too large.`);
      continue;
    }
    const validated = validateDecodedImage({
      key: asset.key,
      mimeType: asset.mimeType,
      buffer,
      originalName: asset.name,
    });
    if (!validated.ok) {
      errors.push(validated.error);
      continue;
    }
    totalBytes += validated.asset.sizeBytes;
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      errors.push(
        `Images exceed the ${MAX_TOTAL_IMAGE_BYTES / 1024 / 1024} MB total expanded limit.`,
      );
      break;
    }
    decoded.push(validated.asset);
  }

  return { ok: errors.length === 0, decoded, errors };
}

export function extractTokens(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(ASSET_TOKEN_REGEX)) {
    out.add(m[1]);
  }
  return Array.from(out);
}

export function rewriteAssetTokens(text: string, resolve: (key: string) => string | null): string {
  return text.replace(ASSET_TOKEN_REGEX, (match, key) => {
    const url = resolve(key);
    return url ? `<img src="${url}" alt="" class="problem-image" />` : match;
  });
}

export function unknownReferencedKeys(statements: string[], availableKeys: Set<string>): string[] {
  const referenced = new Set<string>();
  for (const s of statements) {
    for (const k of extractTokens(s)) referenced.add(k);
  }
  return Array.from(referenced).filter((k) => !availableKeys.has(k));
}

export const MAX_IMAGE_BYTES = MAX_ASSET_BYTES;
export const MAX_IMAGES_PER_SET = MAX_ASSETS_PER_SET;
