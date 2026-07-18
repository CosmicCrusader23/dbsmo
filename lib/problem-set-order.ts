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

/** Compute the next numeric order without materializing every set in Node. */
export async function nextProblemSetOrderFromDatabase(): Promise<string> {
  const { prisma } = await import("@/lib/db");
  const [row] = await prisma.$queryRaw<Array<{ maxOrder: string }>>`
    SELECT COALESCE(
      MAX(
        CASE
          WHEN trim("order") ~ '^[0-9]+$' THEN trim("order")::numeric
          ELSE 0
        END
      ),
      0
    )::text AS "maxOrder"
    FROM "ProblemSet"
  `;
  return String(BigInt(row?.maxOrder ?? "0") + 1n);
}
