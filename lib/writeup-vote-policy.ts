import { z } from "zod";

export const MAX_WRITEUP_VOTE_BODY_BYTES = 1_024;

export function normalizeWriteupVote(value: unknown): -1 | 0 | 1 | null {
  if (value === 1 || value === "1") return 1;
  if (value === -1 || value === "-1") return -1;
  if (value === 0 || value === "0" || value === null) return 0;
  return null;
}

export const writeupVoteSchema = z
  .object({ value: z.unknown() })
  .transform(({ value }, context) => {
    const normalized = normalizeWriteupVote(value);
    if (normalized === null) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Vote must be -1, 0, or 1.",
      });
      return z.NEVER;
    }
    return normalized;
  });
