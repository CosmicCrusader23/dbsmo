type RoomStatus = "LOBBY" | "IN_PROGRESS" | "COMPLETED";

export type RoomAdvanceDecision = {
  kind: "idle" | "wait-for-host" | "complete" | "pick-next";
  claimCurrent: boolean;
};

export function decideRoomAdvance(input: {
  status: RoomStatus;
  hasCurrent: boolean;
  currentLocked: boolean;
  currentTimedOut: boolean;
  activePlayerIds: readonly string[];
  answeredPlayerIds: ReadonlySet<string>;
  currentIndex: number;
  totalProblems: number;
}): RoomAdvanceDecision {
  if (input.status !== "IN_PROGRESS") {
    return { kind: "idle", claimCurrent: false };
  }

  if (!input.hasCurrent) {
    return { kind: "pick-next", claimCurrent: false };
  }

  const allAnswered =
    input.activePlayerIds.length > 0 &&
    input.activePlayerIds.every((id) => input.answeredPlayerIds.has(id));
  const ready = input.currentLocked || allAnswered || input.currentTimedOut;
  if (!ready) {
    return { kind: "idle", claimCurrent: false };
  }

  const claimCurrent = !input.currentLocked;
  if (input.activePlayerIds.length > 1) {
    return { kind: "wait-for-host", claimCurrent };
  }

  if (input.currentIndex + 1 >= input.totalProblems) {
    return { kind: "complete", claimCurrent };
  }

  return { kind: "pick-next", claimCurrent };
}
