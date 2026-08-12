export type QueryParamValue = string | string[] | null | undefined;

export function firstQueryParam(value: QueryParamValue): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first ?? undefined;
}

export function normalizeQueryText(value: QueryParamValue, maxLength = 80): string {
  const boundedLength = Number.isSafeInteger(maxLength) && maxLength >= 0 ? maxLength : 80;
  return (firstQueryParam(value) ?? "").trim().slice(0, boundedLength);
}

export function normalizePageNumber(value: QueryParamValue): number {
  const parsed = Number(firstQueryParam(value) ?? "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}
