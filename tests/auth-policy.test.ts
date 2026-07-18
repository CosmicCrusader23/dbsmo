import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHOOL_EMAIL_DOMAINS,
  isAllowedSchoolEmail,
  isDevBypassEnabled,
  parseSchoolEmailDomains,
  resolveSessionAuthority,
} from "../lib/auth-policy";

describe("school email policy", () => {
  it("uses the DBS defaults only when the setting is omitted", () => {
    expect(parseSchoolEmailDomains(undefined)).toEqual([...DEFAULT_SCHOOL_EMAIL_DOMAINS]);
    expect(parseSchoolEmailDomains("")).toEqual([]);
  });

  it("normalizes, deduplicates, and rejects unsafe domain entries", () => {
    expect(
      parseSchoolEmailDomains(
        " @G.DBS.EDU.HK,dbs.edu.hk.,g.dbs.edu.hk,https://dbs.edu.hk,*.dbs.edu.hk ",
      ),
    ).toEqual(["g.dbs.edu.hk", "dbs.edu.hk"]);
    expect(parseSchoolEmailDomains("https://example.com,*")).toEqual([]);
  });

  it("matches the exact normalized email domain rather than a suffix", () => {
    const domains = parseSchoolEmailDomains("g.dbs.edu.hk,dbs.edu.hk");
    expect(isAllowedSchoolEmail("Student@G.DBS.EDU.HK", domains)).toBe(true);
    expect(isAllowedSchoolEmail("teacher@dbs.edu.hk", domains)).toBe(true);
    expect(isAllowedSchoolEmail("student@evil-g.dbs.edu.hk", domains)).toBe(false);
    expect(isAllowedSchoolEmail("student@sub.g.dbs.edu.hk", domains)).toBe(false);
    expect(isAllowedSchoolEmail("student@@g.dbs.edu.hk", domains)).toBe(false);
  });

  it("permits an exact configured email exception", () => {
    expect(isAllowedSchoolEmail("Person@Example.com", [], ["person@example.com"])).toBe(true);
    expect(isAllowedSchoolEmail("other@example.com", [], ["person@example.com"])).toBe(false);
  });
});

describe("developer bypass policy", () => {
  it("requires an explicit true flag outside production", () => {
    expect(isDevBypassEnabled("development", "true")).toBe(true);
    expect(isDevBypassEnabled("test", "true")).toBe(true);
    expect(isDevBypassEnabled("development", undefined)).toBe(false);
    expect(isDevBypassEnabled("development", "false")).toBe(false);
    expect(isDevBypassEnabled("development", "1")).toBe(false);
    expect(isDevBypassEnabled("production", "true")).toBe(false);
    expect(isDevBypassEnabled(" Production ", "true")).toBe(false);
  });
});

describe("session authority policy", () => {
  it("returns current database authority for a live user", () => {
    expect(
      resolveSessionAuthority("user-1", {
        role: "TEACHER",
        group: "MO",
        image: "https://example.com/avatar.png",
      }),
    ).toEqual({
      id: "user-1",
      role: "TEACHER",
      group: "MO",
      image: "https://example.com/avatar.png",
    });
  });

  it("does not fall back to token authority for a deleted user", () => {
    expect(resolveSessionAuthority("deleted-admin", null)).toBeNull();
    expect(
      resolveSessionAuthority(undefined, { role: "ADMIN", group: null, image: null }),
    ).toBeNull();
  });
});
