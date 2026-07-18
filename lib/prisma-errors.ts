export function isPrismaKnownError(err: unknown, code?: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  const errCode = (err as { code?: unknown }).code;
  if (name !== "PrismaClientKnownRequestError") return false;
  if (code === undefined) return true;
  return errCode === code;
}

export function isPrismaUniqueViolation(err: unknown): boolean {
  return isPrismaKnownError(err, "P2002");
}

export function isPrismaTransactionConflict(err: unknown): boolean {
  return isPrismaKnownError(err, "P2034");
}

export function isRetryablePrismaTransactionError(err: unknown): boolean {
  return isPrismaUniqueViolation(err) || isPrismaTransactionConflict(err);
}
