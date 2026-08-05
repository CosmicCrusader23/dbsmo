import type { SidebarNavLink } from "./sidebar-navigation";

export const SIDEBAR_PREFERENCES_STORAGE_KEY = "dbsmo-sidebar-preferences";
export const SIDEBAR_PREFERENCES_EVENT = "dbsmo:sidebar-preferences-change";

const MAX_ORDER_ITEMS = 40;
const MAX_HIDDEN_ITEMS = 40;
const MAX_ENABLED_ITEMS = 20;

export type SidebarPreferences = {
  order: string[];
  hidden: string[];
  enabled: string[];
};

export const EMPTY_SIDEBAR_PREFERENCES: SidebarPreferences = {
  order: [],
  hidden: [],
  enabled: [],
};

function cleanKeys(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean),
    ),
  ).slice(0, maxLength);
}

export function sidebarPreferenceKey(link: SidebarNavLink) {
  return link.preferenceKey ?? link.href;
}

export function mergeSidebarLinks(
  defaultLinks: SidebarNavLink[],
  preferences: SidebarPreferences,
  optionalLinks: SidebarNavLink[] = [],
): SidebarNavLink[] {
  const enabled = new Set(preferences.enabled);
  const defaultKeys = new Set(defaultLinks.map(sidebarPreferenceKey));
  const selectedOptionalLinks = optionalLinks.filter(
    (link) =>
      enabled.has(sidebarPreferenceKey(link)) && !defaultKeys.has(sidebarPreferenceKey(link)),
  );
  const allLinks = [...defaultLinks, ...selectedOptionalLinks];
  const byKey = new Map(allLinks.map((link) => [sidebarPreferenceKey(link), link]));
  const orderedKeys = [...preferences.order, ...allLinks.map(sidebarPreferenceKey)];
  const seen = new Set<string>();

  return orderedKeys.reduce<SidebarNavLink[]>((result, key) => {
    const link = byKey.get(key);
    if (!link || seen.has(key)) return result;
    seen.add(key);
    result.push(link);
    return result;
  }, []);
}

export function visibleSidebarLinks(
  defaultLinks: SidebarNavLink[],
  preferences: SidebarPreferences,
  optionalLinks: SidebarNavLink[] = [],
) {
  const hidden = new Set(preferences.hidden);
  return mergeSidebarLinks(defaultLinks, preferences, optionalLinks).filter(
    (link) => !hidden.has(sidebarPreferenceKey(link)),
  );
}

export function parseSidebarPreferences(value: string | null): SidebarPreferences {
  if (!value) return EMPTY_SIDEBAR_PREFERENCES;
  try {
    const parsed = JSON.parse(value) as Partial<SidebarPreferences>;
    return {
      order: cleanKeys(parsed.order, MAX_ORDER_ITEMS),
      hidden: cleanKeys(parsed.hidden, MAX_HIDDEN_ITEMS),
      enabled: cleanKeys(parsed.enabled, MAX_ENABLED_ITEMS),
    };
  } catch {
    return EMPTY_SIDEBAR_PREFERENCES;
  }
}

export function sidebarPreferencesStorageKey(userId?: string | null) {
  const normalizedUserId = typeof userId === "string" ? userId.trim().slice(0, 120) : "";
  return normalizedUserId
    ? `${SIDEBAR_PREFERENCES_STORAGE_KEY}:${encodeURIComponent(normalizedUserId)}`
    : SIDEBAR_PREFERENCES_STORAGE_KEY;
}

export function readSidebarPreferences(
  userId?: string | null,
  fallback: SidebarPreferences = EMPTY_SIDEBAR_PREFERENCES,
): SidebarPreferences {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(sidebarPreferencesStorageKey(userId));
    return stored === null ? fallback : parseSidebarPreferences(stored);
  } catch {
    return fallback;
  }
}

export function writeSidebarPreferences(preferences: SidebarPreferences, userId?: string | null) {
  try {
    localStorage.setItem(sidebarPreferencesStorageKey(userId), JSON.stringify(preferences));
    window.dispatchEvent(new Event(SIDEBAR_PREFERENCES_EVENT));
  } catch {
    // Private browsing/storage restrictions should not break navigation.
  }
}

export function resetSidebarPreferences(userId?: string | null) {
  try {
    // Keep an explicit empty value so listeners can distinguish reset from a missing cache.
    localStorage.setItem(
      sidebarPreferencesStorageKey(userId),
      JSON.stringify(EMPTY_SIDEBAR_PREFERENCES),
    );
    window.dispatchEvent(new Event(SIDEBAR_PREFERENCES_EVENT));
  } catch {
    // Private browsing/storage restrictions should not break navigation.
  }
}
