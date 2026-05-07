type ProblemSetOrderRecord = {
  createdAt?: Date;
  order: string;
  title?: string;
};

export function compareProblemSetOrder(left: string, right: string): number {
  const leftValue = left.trim();
  const rightValue = right.trim();

  if (!leftValue && rightValue) return 1;
  if (leftValue && !rightValue) return -1;

  const natural = leftValue.localeCompare(rightValue, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  return natural || left.localeCompare(right);
}

export function compareProblemSetRecords<T extends ProblemSetOrderRecord>(left: T, right: T) {
  const byOrder = compareProblemSetOrder(left.order, right.order);
  if (byOrder !== 0) return byOrder;

  if (left.createdAt && right.createdAt) {
    const byCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
    if (byCreatedAt !== 0) return byCreatedAt;
  }

  return (left.title ?? "").localeCompare(right.title ?? "");
}

export function nextProblemSetOrder(orders: string[]): string {
  let maxOrder = 0n;

  for (const order of orders) {
    const value = order.trim();
    if (!/^\d+$/.test(value)) continue;

    const numericValue = BigInt(value);
    if (numericValue > maxOrder) {
      maxOrder = numericValue;
    }
  }

  return String(maxOrder + 1n);
}
