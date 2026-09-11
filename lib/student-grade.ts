const SCHOOL_TIME_ZONE = "Asia/Hong_Kong";
const SCHOOL_EMAIL_DOMAIN = "g.dbs.edu.hk";

function hongKongDateParts(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Could not determine the Hong Kong school year.");
  }
  return { year, month };
}

export function schoolYearStartYear(date = new Date()): number {
  const { year, month } = hongKongDateParts(date);
  return month >= 9 ? year : year - 1;
}

export function schoolYearLabel(date = new Date()): string {
  const startYear = schoolYearStartYear(date);
  return `${String(startYear).slice(-2)}${String(startYear + 1).slice(-2)}`;
}

/** Decode prefixes such as dbs22072000@g.dbs.edu.hk into the current grade. */
export function gradeFromStudentEmail(email: string, date = new Date()): number | null {
  const normalizedEmail = email.trim().toLowerCase();
  const separator = normalizedEmail.lastIndexOf("@");
  if (separator < 0 || normalizedEmail.slice(separator + 1) !== SCHOOL_EMAIL_DOMAIN) {
    return null;
  }

  const match = /^dbs(\d{2})(\d{2})/.exec(normalizedEmail.slice(0, separator));
  if (!match) return null;

  const cohortYear = 2000 + Number(match[1]);
  const entryGrade = Number(match[2]);
  const grade = schoolYearStartYear(date) - cohortYear + entryGrade;
  return Number.isInteger(grade) && grade >= 1 && grade <= 13 ? grade : null;
}
