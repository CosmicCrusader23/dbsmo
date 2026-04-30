/**
 * Draft / published visibility helpers.
 *
 * These are pure functions — no database calls — so they can be used
 * both in server queries and in the UI layer.
 */

type SetForVisibility = {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibleFrom: Date | null;
  visibleTo: Date | null;
};

/**
 * Returns `true` if a problem set should be visible to a student
 * evaluated at the supplied date.
 */
export function isVisibleToStudent(set: SetForVisibility, now: Date = new Date()): boolean {
  if (set.status !== "PUBLISHED") {
    return false;
  }

  if (set.visibleFrom && now < set.visibleFrom) {
    return false;
  }

  if (set.visibleTo && now > set.visibleTo) {
    return false;
  }

  return true;
}

/** Human-readable display label for a set's current status. */
export function statusLabel(set: SetForVisibility, now: Date = new Date()): string {
  if (set.status === "DRAFT") return "Draft";
  if (set.status === "ARCHIVED") return "Archived";

  if (set.visibleFrom && now < set.visibleFrom) {
    return "Scheduled";
  }

  return "Published";
}

/** CSS class suffix for the status indicator dot. */
export function statusColor(set: SetForVisibility, now: Date = new Date()): string {
  const label = statusLabel(set, now);
  switch (label) {
    case "Draft":
      return "status-not-started";
    case "Published":
      return "status-solved";
    case "Scheduled":
      return "status-attempted";
    case "Archived":
      return "status-review";
    default:
      return "";
  }
}
