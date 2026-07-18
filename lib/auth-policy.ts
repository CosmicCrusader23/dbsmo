import type { UserRole } from "@prisma/client";

export const DEFAULT_SCHOOL_EMAIL_DOMAINS = ["g.dbs.edu.hk", "dbs.edu.hk"] as const;

const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function normalizeDomain(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  return DOMAIN_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Parses the comma-separated SCHOOL_EMAIL_DOMAINS setting.
 *
 * An omitted setting uses the DBS defaults. An explicitly empty or wholly
 * invalid setting stays empty so a bad production configuration fails closed.
 */
export function parseSchoolEmailDomains(value: string | undefined): string[] {
  const configured = value === undefined ? DEFAULT_SCHOOL_EMAIL_DOMAINS : value.split(",");
  const domains = configured
    .map((domain) => normalizeDomain(domain))
    .filter((domain): domain is string => domain !== null);
  return Array.from(new Set(domains));
}

export function isAllowedSchoolEmail(
  email: string | null | undefined,
  schoolDomains: readonly string[],
  allowedEmails: readonly string[] = [],
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || /\s/.test(normalizedEmail)) return false;

  if (allowedEmails.some((allowed) => allowed.trim().toLowerCase() === normalizedEmail)) {
    return true;
  }

  const separator = normalizedEmail.indexOf("@");
  if (
    separator <= 0 ||
    separator !== normalizedEmail.lastIndexOf("@") ||
    separator === normalizedEmail.length - 1
  ) {
    return false;
  }

  const emailDomain = normalizedEmail.slice(separator + 1);
  return schoolDomains.some((domain) => normalizeDomain(domain) === emailDomain);
}

export function isDevBypassEnabled(nodeEnv: string | undefined, configured: string | undefined) {
  return nodeEnv?.trim().toLowerCase() !== "production" && configured === "true";
}

export type SessionDbUser = {
  role: UserRole;
  group: string | null;
  image: string | null;
};

export type SessionAuthority = SessionDbUser & { id: string };

/** Returns null when a token no longer maps to a live database user. */
export function resolveSessionAuthority(
  tokenId: unknown,
  dbUser: SessionDbUser | null,
): SessionAuthority | null {
  if (typeof tokenId !== "string" || tokenId.length === 0 || !dbUser) return null;
  return { id: tokenId, ...dbUser };
}
