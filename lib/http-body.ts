export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "invalid_json" | "too_large" };

export type FormDataBodyResult =
  | { ok: true; value: FormData }
  | { ok: false; reason: "invalid_form" | "too_large" };

type BodyBytesResult =
  | { ok: true; value: Uint8Array<ArrayBuffer> }
  | { ok: false; reason: "invalid_body" | "too_large" };

/**
 * Reject browser requests initiated by another origin/site while allowing
 * same-origin calls, bookmarks, CLI clients, and older clients without Fetch
 * Metadata headers.
 */
export function isCrossSiteBrowserRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

function declaredBodySize(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** Read a request stream with an actual-byte cap, including chunked bodies. */
async function readBodyBytes(
  request: Request,
  { maxBytes }: { maxBytes: number },
): Promise<BodyBytesResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    return { ok: false, reason: "too_large" };
  }

  const declaredSize = declaredBodySize(request);
  if (declaredSize !== null && declaredSize > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  if (!request.body) {
    return { ok: true, value: new Uint8Array() };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        // Do not cancel producer-backed streams here. Undici's multipart
        // encoder can enqueue after cancellation and surface an unhandled
        // ERR_INVALID_STATE. Releasing the reader keeps allocation bounded;
        // the framework owns disposal of the rejected request stream.
        reader.releaseLock();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid_body" };
  }

  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, value: bytes };
}

/**
 * Read and parse JSON while enforcing the limit on streamed bytes. This keeps
 * chunked requests from bypassing a Content-Length-only check.
 */
export async function readJsonBody(
  request: Request,
  { maxBytes }: { maxBytes: number },
): Promise<JsonBodyResult> {
  const body = await readBodyBytes(request, { maxBytes });
  if (!body.ok) {
    return {
      ok: false,
      reason: body.reason === "too_large" ? "too_large" : "invalid_json",
    };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body.value);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

/** Parse multipart or URL-encoded forms only after bounding their raw bytes. */
export async function readFormDataBody(
  request: Request,
  { maxBytes }: { maxBytes: number },
): Promise<FormDataBodyResult> {
  const body = await readBodyBytes(request, { maxBytes });
  if (!body.ok) {
    return {
      ok: false,
      reason: body.reason === "too_large" ? "too_large" : "invalid_form",
    };
  }

  try {
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: body.value,
    });
    return { ok: true, value: await boundedRequest.formData() };
  } catch {
    return { ok: false, reason: "invalid_form" };
  }
}
