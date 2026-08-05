"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Code2,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Link2,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import type { SidebarNavLink } from "@/lib/sidebar-navigation";
import {
  EMPTY_SIDEBAR_PREFERENCES,
  mergeSidebarLinks,
  normalizeSidebarHref,
  parseSidebarPreferences,
  readSidebarPreferences,
  resetSidebarPreferences,
  sidebarPreferenceKey,
  type SidebarPreferences,
  writeSidebarPreferences,
} from "@/lib/sidebar-preferences";

const EMPTY_PREFERENCES_SNAPSHOT = JSON.stringify(EMPTY_SIDEBAR_PREFERENCES);

function getSidebarPreferencesSnapshot() {
  return typeof window === "undefined"
    ? EMPTY_PREFERENCES_SNAPSHOT
    : JSON.stringify(readSidebarPreferences());
}

function subscribeSidebarPreferences(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("dbsmo:sidebar-preferences-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("dbsmo:sidebar-preferences-change", callback);
  };
}

const ICON_OPTIONS = [
  { value: "Link2", label: "Link", icon: Link2 },
  { value: "BookOpen", label: "Book", icon: BookOpen },
  { value: "FileText", label: "Page", icon: FileText },
  { value: "Globe2", label: "Web", icon: Globe2 },
  { value: "Code2", label: "Code", icon: Code2 },
  { value: "Star", label: "Star", icon: Star },
] as const;

function SidebarSettingsIcon({ name }: { name: string }) {
  const option = ICON_OPTIONS.find((item) => item.value === name);
  const Icon = option?.icon ?? Link2;
  return <Icon size={19} />;
}

function newCustomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function SidebarSettings({ defaultLinks }: { defaultLinks: SidebarNavLink[] }) {
  const preferencesSnapshot = useSyncExternalStore(
    subscribeSidebarPreferences,
    getSidebarPreferencesSnapshot,
    () => EMPTY_PREFERENCES_SNAPSHOT,
  );
  const preferences = useMemo(
    () => parseSidebarPreferences(preferencesSnapshot),
    [preferencesSnapshot],
  );
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [icon, setIcon] = useState("Link2");
  const [formError, setFormError] = useState<string | null>(null);

  const orderedLinks = useMemo(
    () => mergeSidebarLinks(defaultLinks, preferences),
    [defaultLinks, preferences],
  );
  const hidden = new Set(preferences.hidden);
  const visibleCount = orderedLinks.filter((link) => !hidden.has(sidebarPreferenceKey(link))).length;

  function save(next: SidebarPreferences) {
    writeSidebarPreferences(next);
  }

  function moveLink(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedLinks.length) return;
    const nextOrder = orderedLinks.map(sidebarPreferenceKey);
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
    save({ ...preferences, order: nextOrder });
  }

  function toggleLink(link: SidebarNavLink) {
    const key = sidebarPreferenceKey(link);
    const isHidden = hidden.has(key);
    if (!isHidden && visibleCount <= 1) return;
    save({
      ...preferences,
      hidden: isHidden
        ? preferences.hidden.filter((item) => item !== key)
        : [...preferences.hidden, key],
    });
  }

  function removeCustomLink(link: SidebarNavLink) {
    const key = sidebarPreferenceKey(link);
    const id = key.startsWith("custom:") ? key.slice("custom:".length) : "";
    save({
      ...preferences,
      custom: preferences.custom.filter((item) => item.id !== id),
      order: preferences.order.filter((item) => item !== key),
      hidden: preferences.hidden.filter((item) => item !== key),
    });
  }

  function addCustomLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const cleanLabel = label.trim().slice(0, 40);
    const cleanHref = normalizeSidebarHref(href);
    if (!cleanLabel || !cleanHref) {
      setFormError("Enter a label and a safe path or http(s) URL.");
      return;
    }
    if (
      [...defaultLinks.map((link) => link.href), ...preferences.custom.map((link) => link.href)].includes(
        cleanHref,
      )
    ) {
      setFormError("That page is already in your sidebar.");
      return;
    }

    const id = newCustomId();
    const key = `custom:${id}`;
    save({
      ...preferences,
      custom: [
        ...preferences.custom,
        { id, label: cleanLabel, href: cleanHref, icon, external: !cleanHref.startsWith("/") },
      ],
      order: [...preferences.order, key],
    });
    setLabel("");
    setHref("");
    setIcon("Link2");
  }

  function reset() {
    resetSidebarPreferences();
    setFormError(null);
  }

  return (
    <section className="sidebar-settings-panel" aria-labelledby="sidebar-settings-title">
      <header className="sidebar-settings-header">
        <div>
          <p className="eyebrow">Personal layout</p>
          <h2 id="sidebar-settings-title">Sidebar</h2>
          <p>Reorder or hide links, then add pages you use often.</p>
        </div>
        <button className="secondary-action compact" type="button" onClick={reset}>
          <RotateCcw size={16} />
          Reset to default
        </button>
      </header>

      <div className="sidebar-settings-list">
        {orderedLinks.map((link, index) => {
          const key = sidebarPreferenceKey(link);
          const isHidden = hidden.has(key);
          return (
            <div className={`sidebar-settings-item${isHidden ? " is-hidden" : ""}`} key={key}>
              <span className="sidebar-settings-item-icon" aria-hidden="true">
                <SidebarSettingsIcon name={link.icon} />
              </span>
              <span className="sidebar-settings-item-copy">
                <strong>{link.label}</strong>
                <small>{link.href}</small>
              </span>
              <div className="sidebar-settings-item-actions">
                <button
                  aria-label={`${isHidden ? "Show" : "Hide"} ${link.label}`}
                  className="icon-button compact"
                  disabled={!isHidden && visibleCount <= 1}
                  title={`${isHidden ? "Show" : "Hide"} ${link.label}`}
                  type="button"
                  onClick={() => toggleLink(link)}
                >
                  {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  aria-label={`Move ${link.label} up`}
                  className="icon-button compact"
                  disabled={index === 0}
                  title="Move up"
                  type="button"
                  onClick={() => moveLink(index, -1)}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  aria-label={`Move ${link.label} down`}
                  className="icon-button compact"
                  disabled={index === orderedLinks.length - 1}
                  title="Move down"
                  type="button"
                  onClick={() => moveLink(index, 1)}
                >
                  <ChevronDown size={16} />
                </button>
                {link.custom ? (
                  <button
                    aria-label={`Delete ${link.label}`}
                    className="icon-button compact danger"
                    title="Delete custom page"
                    type="button"
                    onClick={() => removeCustomLink(link)}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <form className="sidebar-custom-form" onSubmit={addCustomLink}>
        <div>
          <p className="eyebrow">Add a page</p>
          <h3>Custom sidebar link</h3>
          <p>Use an internal path like <code>/writeups</code> or a trusted http(s) URL.</p>
        </div>
        <div className="sidebar-custom-fields">
          <label>
            <span>Label</span>
            <input maxLength={40} placeholder="My resources" value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            <span>Path or URL</span>
            <input maxLength={500} placeholder="/problem-sets" value={href} onChange={(event) => setHref(event.target.value)} />
          </label>
          <label>
            <span>Icon</span>
            <select value={icon} onChange={(event) => setIcon(event.target.value)}>
              {ICON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-action compact" type="submit">
            <Plus size={16} />
            Add page
          </button>
        </div>
        {formError ? <p className="sidebar-settings-error">{formError}</p> : null}
      </form>
    </section>
  );
}
