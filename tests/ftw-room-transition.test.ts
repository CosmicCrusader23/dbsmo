import { describe, expect, it } from "vitest";
import { decideRoomAdvance } from "../lib/ftw-room-transition";

const base = {
  status: "IN_PROGRESS" as const,
  hasCurrent: true,
  currentLocked: false,
  currentTimedOut: false,
  activePlayerIds: ["player-1"],
  answeredPlayerIds: new Set<string>(),
  currentIndex: 0,
  totalProblems: 10,
};

describe("decideRoomAdvance", () => {
  it("keeps a live unanswered round idle", () => {
    expect(decideRoomAdvance(base)).toEqual({ kind: "idle", claimCurrent: false });
  });

  it("claims an answered multiplayer round exactly before waiting for the host", () => {
    expect(
      decideRoomAdvance({
        ...base,
        activePlayerIds: ["player-1", "player-2"],
        answeredPlayerIds: new Set(["player-1", "player-2"]),
      }),
    ).toEqual({ kind: "wait-for-host", claimCurrent: true });
  });

  it("completes a timed-out final solo round after claiming it", () => {
    expect(
      decideRoomAdvance({
        ...base,
        currentTimedOut: true,
        currentIndex: 9,
      }),
    ).toEqual({ kind: "complete", claimCurrent: true });
  });

  it("picks the first problem without trying to claim a missing round", () => {
    expect(
      decideRoomAdvance({
        ...base,
        hasCurrent: false,
        activePlayerIds: ["player-1", "player-2"],
      }),
    ).toEqual({ kind: "pick-next", claimCurrent: false });
  });

  it("does not reclaim a locked multiplayer round", () => {
    expect(
      decideRoomAdvance({
        ...base,
        currentLocked: true,
        activePlayerIds: ["player-1", "player-2"],
      }),
    ).toEqual({ kind: "wait-for-host", claimCurrent: false });
  });

  it("auto-advances a locked non-final solo round", () => {
    expect(decideRoomAdvance({ ...base, currentLocked: true })).toEqual({
      kind: "pick-next",
      claimCurrent: false,
    });
  });
});
