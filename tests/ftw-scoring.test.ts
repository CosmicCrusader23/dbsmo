import { describe, it, expect } from "vitest";
import { roomScore, maxRoomScorePerProblem, generateRoomCode } from "../lib/ftw-room";
import { scoreFromElapsed } from "../lib/ftw";

describe("FTW solo scoring", () => {
  it("awards 0 for wrong answers", () => {
    expect(scoreFromElapsed(1000, false)).toBe(0);
  });
  it("awards 0 when timed out (>=45s)", () => {
    expect(scoreFromElapsed(45000, true)).toBe(0);
  });
  it("awards 6 instantly, 1 minimum", () => {
    expect(scoreFromElapsed(0, true)).toBe(6);
    expect(scoreFromElapsed(44000, true)).toBeGreaterThanOrEqual(1);
  });
  it("decays monotonically", () => {
    let prev = 7;
    for (let s = 0; s < 45; s += 5) {
      const v = scoreFromElapsed(s * 1000, true);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("FTW room scoring", () => {
  const limit = 45000;
  it("awards full base+speed bonus on instant correct answer", () => {
    expect(roomScore(0, limit, true)).toBe(maxRoomScorePerProblem());
  });
  it("returns 0 for wrong answer regardless of time", () => {
    expect(roomScore(0, limit, false)).toBe(0);
    expect(roomScore(20000, limit, false)).toBe(0);
  });
  it("returns 0 once the problem timer ran out", () => {
    expect(roomScore(limit, limit, true)).toBe(0);
    expect(roomScore(limit + 100, limit, true)).toBe(0);
  });
  it("base bonus is at least 2 for any answer that beats the timer", () => {
    expect(roomScore(limit - 1, limit, true)).toBeGreaterThanOrEqual(2);
  });
  it("decays smoothly over the time window", () => {
    const fast = roomScore(2000, limit, true);
    const mid = roomScore(20000, limit, true);
    const slow = roomScore(40000, limit, true);
    expect(fast).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(slow);
  });
});

describe("FTW room codes", () => {
  it("generates uppercase alphanumeric codes of the requested length", () => {
    const code = generateRoomCode(5);
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
  });
  it("excludes ambiguous characters (0, O, 1, I)", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode(8)).not.toMatch(/[01OI]/);
    }
  });
  it("rejects invalid room-code lengths", () => {
    expect(() => generateRoomCode(0)).toThrow(RangeError);
    expect(() => generateRoomCode(33)).toThrow(RangeError);
  });
});
