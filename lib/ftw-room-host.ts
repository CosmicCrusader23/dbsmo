export type RoomPlayerRef = { userId: string; joinedAt: Date };
export type RoomStatus = "LOBBY" | "IN_PROGRESS" | "COMPLETED";

export type HostTransition =
  | { kind: "noop" }
  | { kind: "transfer"; newHostId: string }
  | { kind: "close" };

export function pickNextHostId(players: RoomPlayerRef[]): string | null {
  if (players.length === 0) return null;
  const sorted = [...players].sort((a, b) => {
    const dt = a.joinedAt.getTime() - b.joinedAt.getTime();
    if (dt !== 0) return dt;
    return a.userId.localeCompare(b.userId);
  });
  return sorted[0].userId;
}

export function decideHostTransition(args: {
  leavingUserId: string;
  currentHostId: string;
  status: RoomStatus;
  remainingActivePlayers: RoomPlayerRef[];
}): HostTransition {
  if (args.status === "COMPLETED") return { kind: "noop" };
  if (args.leavingUserId !== args.currentHostId) return { kind: "noop" };
  const next = pickNextHostId(args.remainingActivePlayers);
  if (next === null) return { kind: "close" };
  return { kind: "transfer", newHostId: next };
}
