export type AttemptForCompletion = { userId: string; submittedAt: Date };

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const NAME_MAX = 80;

export function validateClassName(input: string): ValidationResult<string> {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: "Name cannot be empty." };
  if (trimmed.length > NAME_MAX) {
    return { ok: false, error: `Name must be ${NAME_MAX} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function buildCompletionMap(input: {
  assignmentCreatedAt: Date;
  studentIds: string[];
  attempts: AttemptForCompletion[];
}): Map<string, Date | null> {
  const result = new Map<string, Date | null>();
  for (const id of input.studentIds) result.set(id, null);
  const cutoff = input.assignmentCreatedAt.getTime();
  for (const a of input.attempts) {
    if (!result.has(a.userId)) continue;
    if (a.submittedAt.getTime() <= cutoff) continue;
    const existing = result.get(a.userId);
    if (existing === null || a.submittedAt < existing) {
      result.set(a.userId, a.submittedAt);
    }
  }
  return result;
}
