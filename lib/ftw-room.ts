import { randomInt } from "node:crypto";

export const ROOM_BASE_POINTS = 2;
export const ROOM_SPEED_POINTS = 8;
export const ROOM_DEFAULT_TOTAL = 10;
export const ROOM_DEFAULT_LIMIT_MS = 45000;

export function roomScore(elapsedMs: number, limitMs: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  if (elapsedMs >= limitMs) return 0;
  const fraction = Math.max(0, 1 - elapsedMs / limitMs);
  const raw = ROOM_BASE_POINTS + ROOM_SPEED_POINTS * fraction;
  return Math.round(raw);
}

export function maxRoomScorePerProblem(): number {
  return ROOM_BASE_POINTS + ROOM_SPEED_POINTS;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 5): string {
  if (!Number.isSafeInteger(length) || length < 1 || length > 32) {
    throw new RangeError("Room code length must be an integer from 1 to 32.");
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}
