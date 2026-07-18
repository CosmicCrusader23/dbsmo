import type { UserRole } from "@prisma/client";
import { isVisibleToStudent } from "./visibility";

type ProfileLinkedSet = {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibleFrom: Date | null;
  visibleTo: Date | null;
};

/** Keep profile links aligned with the destination problem-set access gate. */
export function canLinkProblemSetFromProfile(
  set: ProfileLinkedSet,
  viewerRole: UserRole,
  now: Date = new Date(),
): boolean {
  return viewerRole === "ADMIN" || isVisibleToStudent(set, now);
}
