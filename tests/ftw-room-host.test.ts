import { describe, it, expect } from "vitest";
import { decideHostTransition, pickNextHostId } from "../lib/ftw-room-host";

const t = (s: string) => new Date(s);

describe("pickNextHostId", () => {
  it("returns null when there are no players", () => {
    expect(pickNextHostId([])).toBeNull();
  });

  it("returns the earliest joiner", () => {
    expect(
      pickNextHostId([
        { userId: "c", joinedAt: t("2026-05-23T12:00:02Z") },
        { userId: "a", joinedAt: t("2026-05-23T12:00:00Z") },
        { userId: "b", joinedAt: t("2026-05-23T12:00:01Z") },
      ]),
    ).toBe("a");
  });

  it("breaks joinedAt ties by userId so the choice is deterministic", () => {
    const sameTs = t("2026-05-23T12:00:00Z");
    expect(
      pickNextHostId([
        { userId: "z", joinedAt: sameTs },
        { userId: "m", joinedAt: sameTs },
      ]),
    ).toBe("m");
  });
});

describe("decideHostTransition", () => {
  it("does nothing when a non-host leaves", () => {
    const res = decideHostTransition({
      leavingUserId: "u2",
      currentHostId: "u1",
      status: "LOBBY",
      remainingActivePlayers: [{ userId: "u1", joinedAt: t("2026-01-01T00:00:00Z") }],
    });
    expect(res).toEqual({ kind: "noop" });
  });

  it("does nothing when the room is already completed", () => {
    const res = decideHostTransition({
      leavingUserId: "u1",
      currentHostId: "u1",
      status: "COMPLETED",
      remainingActivePlayers: [],
    });
    expect(res).toEqual({ kind: "noop" });
  });

  it("transfers host to the next-earliest joiner when the host leaves", () => {
    const res = decideHostTransition({
      leavingUserId: "u1",
      currentHostId: "u1",
      status: "LOBBY",
      remainingActivePlayers: [
        { userId: "u3", joinedAt: t("2026-05-23T12:00:02Z") },
        { userId: "u2", joinedAt: t("2026-05-23T12:00:01Z") },
      ],
    });
    expect(res).toEqual({ kind: "transfer", newHostId: "u2" });
  });

  it("closes the room when the host leaves and no one else is left", () => {
    const res = decideHostTransition({
      leavingUserId: "u1",
      currentHostId: "u1",
      status: "LOBBY",
      remainingActivePlayers: [],
    });
    expect(res).toEqual({ kind: "close" });
  });

  it("transfers during IN_PROGRESS rather than ending the match", () => {
    const res = decideHostTransition({
      leavingUserId: "u1",
      currentHostId: "u1",
      status: "IN_PROGRESS",
      remainingActivePlayers: [
        { userId: "u2", joinedAt: t("2026-05-23T12:00:01Z") },
      ],
    });
    expect(res).toEqual({ kind: "transfer", newHostId: "u2" });
  });

  it("closes during IN_PROGRESS when the host was the only active player", () => {
    const res = decideHostTransition({
      leavingUserId: "u1",
      currentHostId: "u1",
      status: "IN_PROGRESS",
      remainingActivePlayers: [],
    });
    expect(res).toEqual({ kind: "close" });
  });
});
