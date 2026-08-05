import type { SidebarNavLink } from "./sidebar-navigation";

export const SIDEBAR_PREFERENCES_STORAGE_KEY = "dbsmo-sidebar-preferences";
export const SIDEBAR_PREFERENCES_EVENT = "dbsmo:sidebar-preferences-change";

const MAX_CUSTOM_LINKS = 12;
const MAX_ORDER_ITEMS = 40;
const MAX_HIDDEN_ITEMS = 40;

export type CustomSidebarLink = {
  id: string;
  label: string;
  href: string;
  icon: string;
  external: boolean;
};

export type SidebarPreferences = {
  order: string[];
  hidden: string[];
  custom: CustomSidebarLink[];
};

export const EMPTY_SIDEBAR_PREFERENCES: SidebarPreferences = {
  order: [],
  hidden: [],
  custom: [],
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeSidebarHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function sidebarPreferenceKey(link: SidebarNavLink) {
  return link.preferenceKey ?? link.href;
}

export function mergeSidebarLinks(
  defaultLinks: SidebarNavLink[],
  preferences: SidebarPreferences,
): SidebarNavLink[] {
  const customLinks = preferences.custom.map((link) => ({
    href: link.href,
    label: link.label,
    icon: link.icon,
    external: link.external,
    custom: true,
    preferenceKey: `custom:${link.id}`,
  }));
  const allLinks = [...defaultLinks, ...customLinks];
  const byKey = new Map(allLinks.map((link) => [sidebarPreferenceKey(link), link]));
  const orderedKeys = [
    ...preferences.order,
    ...allLinks.map((link) => sidebarPreferenceKey(link)),
  ];
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
) {
  const hidden = new Set(preferences.hidden);
  return mergeSidebarLinks(defaultLinks, preferences).filter(
    (link) => !hidden.has(sidebarPreferenceKey(link)),
  );
}

export function parseSidebarPreferences(value: string | null): SidebarPreferences {
  if (!value) return EMPTY_SIDEBAR_PREFERENCES;
  try {
    const parsed = JSON.parse(value) as Partial<SidebarPreferences>;
    const custom: CustomSidebarLink[] = [];
    for (const item of Array.isArray(parsed.custom) ? parsed.custom : []) {
      if (!item || typeof item !== "object") continue;
      const raw = item as Partial<CustomSidebarLink>;
      const label = cleanText(raw.label, 40);
      const href = typeof raw.href === "string" ? normalizeSidebarHref(raw.href) : null;
      const id = cleanText(raw.id, 48);
      if (!id || !label || !href || custom.some((existing) => existing.id === id)) continue;
      custom.push({
        id,
        label,
        href,
        icon: cleanText(raw.icon, 32) || "Link2",
        external: raw.external === true,
      });
      if (custom.length >= MAX_CUSTOM_LINKS) break;
    }

    return {
      order: Array.isArray(parsed.order)
        ? parsed.order.filter((item): item is string => typeof item === "string").slice(0, MAX_ORDER_ITEMS)
        : [],
      hidden: Array.isArray(parsed.hidden)
        ? parsed.hidden.filter((item): item is string => typeof item === "string").slice(0, MAX_HIDDEN_ITEMS)
        : [],
      custom,
    };
  } catch {
    return EMPTY_SIDEBAR_PREFERENCES;
  }
}

export function readSidebarPreferences(): SidebarPreferences {
  if (typeof window === "undefined") return EMPTY_SIDEBAR_PREFERENCES;
  try {
    return parseSidebarPreferences(localStorage.getItem(SIDEBAR_PREFERENCES_STORAGE_KEY));
  } catch {
    return EMPTY_SIDEBAR_PREFERENCES;
  }
}

export function writeSidebarPreferences(preferences: SidebarPreferences) {
  try {
    localStorage.setItem(SIDEBAR_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new Event(SIDEBAR_PREFERENCES_EVENT));
  } catch {
    // Private browsing/storage restrictions should not break navigation.
  }
}

export function resetSidebarPreferences() {
  try {
    localStorage.removeItem(SIDEBAR_PREFERENCES_STORAGE_KEY);
    window.dispatchEvent(new Event(SIDEBAR_PREFERENCES_EVENT));
  } catch {
    // Private browsing/storage restrictions should not break navigation.
  }
}
