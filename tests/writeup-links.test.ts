import { describe, expect, it } from "vitest";
import { writeupPostHref, writeupPostId } from "@/lib/writeup-links";

describe("writeup links", () => {
  it("builds a stable post id and deep link", () => {
    expect(writeupPostId("cm-writeup-1")).toBe("writeup-cm-writeup-1");
    expect(writeupPostHref("hle-001", "cm-writeup-1")).toBe(
      "/problem-sets/hle-001/writeups#writeup-cm-writeup-1",
    );
  });
});
