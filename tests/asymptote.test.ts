import { describe, expect, it, vi } from "vitest";
import {
  AsymptoteRenderError,
  asymptoteAssetKey,
  extractAsymptoteBlocks,
  renderEmbeddedAsymptoteStatements,
  replaceAsymptoteBlocks,
  validateAsymptotePng,
} from "../lib/asymptote";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

describe("Asymptote statement integration", () => {
  it("replaces source blocks with deterministic image tokens", () => {
    const statement = "Use this figure.\n<asy>size(100); draw(unitcircle);</asy>\nFind the radius.";
    const blocks = extractAsymptoteBlocks(statement);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].key).toBe(asymptoteAssetKey("size(100); draw(unitcircle);"));
    expect(replaceAsymptoteBlocks(statement, blocks)).toContain(`[[img:${blocks[0].key}]]`);
    expect(replaceAsymptoteBlocks(statement, blocks)).not.toContain("draw(unitcircle)");
  });

  it("rejects incomplete and oversized source before execution", () => {
    expect(() => extractAsymptoteBlocks("<asy>draw(unitcircle);")).toThrow(AsymptoteRenderError);
    expect(() => extractAsymptoteBlocks(`<asy>${"x".repeat(40_001)}</asy>`)).toThrow(/exceeds/);
  });

  it("renders each unique source once and returns validated PNG assets", async () => {
    const render = vi.fn(async () => PNG_1X1);
    const result = await renderEmbeddedAsymptoteStatements(
      ["<asy>draw(unitcircle);</asy>", "Again <asy>draw(unitcircle);</asy>"],
      render,
    );

    expect(render).toHaveBeenCalledTimes(1);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({ mimeType: "image/png", sizeBytes: PNG_1X1.length });
    expect(result.statements[0]).toContain(`[[img:${result.assets[0].key}]]`);
  });

  it("rejects non-PNG and excessive dimensions", () => {
    expect(() => validateAsymptotePng(Buffer.from("not a png"))).toThrow(/valid PNG/);
    const oversized = Buffer.from(PNG_1X1);
    oversized.writeUInt32BE(5_000, 16);
    expect(() => validateAsymptotePng(oversized)).toThrow(/dimensions/);
  });
});
