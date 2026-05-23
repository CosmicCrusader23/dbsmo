/**
 * Problem-set image assets: helpers for parsing inline JSON image declarations
 * and rewriting `[[img:KEY]]` tokens in statements.
 */

import { z } from "zod";

const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_ASSETS_PER_SET = 50;
const ASSET_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SUPPORTED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

export const ASSET_TOKEN_REGEX = /\[\[img:([a-z0-9][a-z0-9_-]{0,63})\]\]/g;

export const imageAssetSchema = z.object({
  key: z.string().regex(ASSET_KEY_PATTERN, {
    message: "Image key must be lowercase letters, digits, '-' or '_' (≤64 chars).",
  }),
  mimeType: z.string().refine((v) => SUPPORTED_IMAGE_MIME.has(v), {
    message: "Image mimeType must be one of png/jpeg/gif/webp/svg+xml.",
  }),
  data: z.string().min(1, { message: "Image data (base64) is required." }),
});

export type ImageAssetInput = z.infer<typeof imageAssetSchema>;

export type DecodedAsset = {
  key: string;
  mimeType: string;
  buffer: Buffer;
  sizeBytes: number;
};

export function decodeAssets(assets: ImageAssetInput[]): {
  ok: boolean;
  decoded: DecodedAsset[];
  errors: string[];
} {
  const errors: string[] = [];
  const decoded: DecodedAsset[] = [];

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
    let buf: Buffer;
    try {
      buf = Buffer.from(asset.data, "base64");
    } catch {
      errors.push(`Image ${asset.key}: base64 decode failed.`);
      continue;
    }
    if (buf.byteLength === 0) {
      errors.push(`Image ${asset.key}: empty after base64 decode.`);
      continue;
    }
    if (buf.byteLength > MAX_ASSET_BYTES) {
      errors.push(
        `Image ${asset.key}: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_ASSET_BYTES / 1024 / 1024}MB limit.`,
      );
      continue;
    }
    decoded.push({ key: asset.key, mimeType: asset.mimeType, buffer: buf, sizeBytes: buf.byteLength });
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

export function rewriteAssetTokens(
  text: string,
  resolve: (key: string) => string | null,
): string {
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
