import { describe, expect, it } from "vitest";
import { isCrossSiteBrowserRequest, readFormDataBody, readJsonBody } from "../lib/http-body";

describe("isCrossSiteBrowserRequest", () => {
  it("rejects cross-site and sibling-site browser requests", () => {
    expect(
      isCrossSiteBrowserRequest(
        new Request("https://dbsmo.example/api/export", {
          headers: { "Sec-Fetch-Site": "cross-site" },
        }),
      ),
    ).toBe(true);
    expect(
      isCrossSiteBrowserRequest(
        new Request("https://dbsmo.example/api/export", {
          headers: { "Sec-Fetch-Site": "same-site" },
        }),
      ),
    ).toBe(true);
  });

  it("allows same-origin, bookmark, and non-browser requests", () => {
    expect(
      isCrossSiteBrowserRequest(
        new Request("https://dbsmo.example/api/export", {
          headers: { "Sec-Fetch-Site": "same-origin" },
        }),
      ),
    ).toBe(false);
    expect(
      isCrossSiteBrowserRequest(
        new Request("https://dbsmo.example/api/export", {
          headers: { "Sec-Fetch-Site": "none" },
        }),
      ),
    ).toBe(false);
    expect(isCrossSiteBrowserRequest(new Request("https://dbsmo.example/api/export"))).toBe(false);
  });

  it("rejects an explicit foreign Origin header", () => {
    expect(
      isCrossSiteBrowserRequest(
        new Request("https://dbsmo.example/api/export", {
          headers: { Origin: "https://evil.example" },
        }),
      ),
    ).toBe(true);
  });
});

describe("readJsonBody", () => {
  it("parses JSON within the byte limit", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });

    await expect(readJsonBody(request, { maxBytes: 100 })).resolves.toEqual({
      ok: true,
      value: { ok: true },
    });
  });

  it("rejects a declared oversized body before reading it", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Length": "101" },
      body: "{}",
    });

    await expect(readJsonBody(request, { maxBytes: 100 })).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects a chunked body once streamed bytes exceed the limit", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"value":"'));
          controller.enqueue(new TextEncoder().encode("x".repeat(100)));
          controller.enqueue(new TextEncoder().encode('"}'));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJsonBody(request, { maxBytes: 32 })).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("http://localhost/api", { method: "POST", body: "{" });

    await expect(readJsonBody(request, { maxBytes: 100 })).resolves.toEqual({
      ok: false,
      reason: "invalid_json",
    });
  });

  it("rejects invalid UTF-8 instead of parsing replacement characters", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]),
    });

    await expect(readJsonBody(request, { maxBytes: 100 })).resolves.toEqual({
      ok: false,
      reason: "invalid_json",
    });
  });

  it("fails closed for an invalid configured byte limit", async () => {
    const request = new Request("http://localhost/api", { method: "POST", body: "{}" });

    await expect(readJsonBody(request, { maxBytes: Number.NaN })).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });
});

describe("readFormDataBody", () => {
  it("parses a multipart form within the byte limit", async () => {
    const form = new FormData();
    form.set("title", "A safe form");
    form.set("file", new File(["contents"], "notes.txt", { type: "text/plain" }));
    const request = new Request("http://localhost/api", { method: "POST", body: form });

    const result = await readFormDataBody(request, { maxBytes: 10_000 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.get("title")).toBe("A safe form");
      expect(result.value.get("file")).toBeInstanceOf(File);
    }
  });

  it("rejects a streamed multipart body beyond the limit", async () => {
    const form = new FormData();
    form.set("value", "x".repeat(1_000));
    const request = new Request("http://localhost/api", { method: "POST", body: form });

    await expect(readFormDataBody(request, { maxBytes: 100 })).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });
});
