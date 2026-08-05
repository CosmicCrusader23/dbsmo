"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  Gauge,
  GraduationCap,
  GripVertical,
  LayoutGrid,
  ListChecks,
  MessageSquareText,
  MessageSquareWarning,
  PenLine,
  RotateCcw,
  Settings,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SidebarNavLink } from "@/lib/sidebar-navigation";
import {
  EMPTY_SIDEBAR_PREFERENCES,
  mergeSidebarLinks,
  readSidebarPreferences,
  resetSidebarPreferences,
  sidebarPreferenceKey,
  type SidebarPreferences,
  writeSidebarPreferences,
} from "@/lib/sidebar-preferences";

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileJson,
  FileText,
  Gauge,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  MessageSquareText,
  MessageSquareWarning,
  PenLine,
  Settings,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  User,
  Users,
};

function SidebarSettingsIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name] ?? LayoutGrid;
  return <Icon size={19} />;
}

type SidebarSettingsProps = {
  defaultLinks: SidebarNavLink[];
  optionalLinks: SidebarNavLink[];
  initialPreferences: SidebarPreferences;
  userId: string;
  onPersist: (preferences: SidebarPreferences) => Promise<void>;
};

export function SidebarSettings({
  defaultLinks,
  optionalLinks,
  initialPreferences,
  userId,
  onPersist,
}: SidebarSettingsProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const confirmedPreferences = useRef(initialPreferences);
  const latestRequestedPreferences = useRef(initialPreferences);

  useEffect(() => {
    const update = () => setPreferences((current) => readSidebarPreferences(userId, current));
    window.addEventListener("storage", update);
    window.addEventListener("dbsmo:sidebar-preferences-change", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("dbsmo:sidebar-preferences-change", update);
    };
  }, [userId]);

  const orderedLinks = useMemo(
    () => mergeSidebarLinks(defaultLinks, preferences, optionalLinks),
    [defaultLinks, optionalLinks, preferences],
  );
  const defaultKeys = useMemo(
    () => new Set(defaultLinks.map(sidebarPreferenceKey)),
    [defaultLinks],
  );
  const hidden = new Set(preferences.hidden);
  const enabled = new Set(preferences.enabled);
  const visibleCount = orderedLinks.filter(
    (link) => !hidden.has(sidebarPreferenceKey(link)),
  ).length;

  function save(next: SidebarPreferences) {
    latestRequestedPreferences.current = next;
    setPreferences(next);
    setSaveError(null);
    setSaved(false);
    writeSidebarPreferences(next, userId);
    setIsSaving(true);

    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await onPersist(next);
        confirmedPreferences.current = next;
        setSaved(true);
      })
      .catch((error: unknown) => {
        // A later queued change may still succeed; only roll back the latest request.
        if (latestRequestedPreferences.current === next) {
          setPreferences(confirmedPreferences.current);
          writeSidebarPreferences(confirmedPreferences.current, userId);
        }
        setSaveError(error instanceof Error ? error.message : "Could not save sidebar settings.");
      })
      .finally(() => setIsSaving(false));
  }

  function moveLink(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedLinks.length) return;
    const nextOrder = orderedLinks.map(sidebarPreferenceKey);
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
    save({ ...preferences, order: nextOrder });
  }

  function reorderLinks(sourceKey: string, targetKey: string) {
    if (sourceKey === targetKey) return;
    const nextOrder = orderedLinks.map(sidebarPreferenceKey);
    const sourceIndex = nextOrder.indexOf(sourceKey);
    const targetIndex = nextOrder.indexOf(targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(nextOrder.indexOf(targetKey), 0, sourceKey);
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

  function toggleAdminTool(link: SidebarNavLink) {
    const key = sidebarPreferenceKey(link);
    if (defaultKeys.has(key)) return;
    const isEnabled = enabled.has(key);
    save({
      ...preferences,
      enabled: isEnabled
        ? preferences.enabled.filter((item) => item !== key)
        : [...preferences.enabled, key],
      order:
        !isEnabled && !preferences.order.includes(key)
          ? [...preferences.order, key]
          : preferences.order,
    });
  }

  function reset() {
    latestRequestedPreferences.current = EMPTY_SIDEBAR_PREFERENCES;
    resetSidebarPreferences(userId);
    setSaveError(null);
    setSaved(false);
    setPreferences(EMPTY_SIDEBAR_PREFERENCES);
    setIsSaving(true);
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await onPersist(EMPTY_SIDEBAR_PREFERENCES);
        confirmedPreferences.current = EMPTY_SIDEBAR_PREFERENCES;
        setSaved(true);
      })
      .catch((error: unknown) => {
        if (latestRequestedPreferences.current === EMPTY_SIDEBAR_PREFERENCES) {
          setPreferences(confirmedPreferences.current);
          writeSidebarPreferences(confirmedPreferences.current, userId);
        }
        setSaveError(error instanceof Error ? error.message : "Could not reset sidebar settings.");
      })
      .finally(() => setIsSaving(false));
  }

  return (
    <section className="sidebar-settings-panel" aria-labelledby="sidebar-settings-title">
      <header className="sidebar-settings-header">
        <div>
          <p className="eyebrow">Personal layout</p>
          <h2 id="sidebar-settings-title">Sidebar</h2>
          <p>Drag links to reorder them, or use the arrow controls. Changes save automatically.</p>
        </div>
        <div className="sidebar-settings-status" aria-live="polite">
          {isSaving ? "Saving…" : saved ? "Saved" : null}
          <button
            className="secondary-action compact"
            type="button"
            onClick={reset}
            disabled={isSaving}
          >
            <RotateCcw size={16} />
            Reset to default
          </button>
        </div>
      </header>

      {saveError ? (
        <p className="sidebar-settings-error" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="sidebar-settings-list" aria-label="Sidebar links">
        {orderedLinks.map((link, index) => {
          const key = sidebarPreferenceKey(link);
          const isHidden = hidden.has(key);
          return (
            <div
              className={`sidebar-settings-item${isHidden ? " is-hidden" : ""}${dragKey === key ? " is-dragging" : ""}${dragOverKey === key ? " is-drag-over" : ""}`}
              draggable
              key={key}
              onDragEnd={() => {
                setDragKey(null);
                setDragOverKey(null);
              }}
              onDragOver={(event) => {
                if (!dragKey || dragKey === key) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverKey(key);
              }}
              onDragStart={(event) => {
                setDragKey(key);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", key);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceKey = event.dataTransfer.getData("text/plain") || dragKey;
                if (sourceKey) reorderLinks(sourceKey, key);
                setDragKey(null);
                setDragOverKey(null);
              }}
            >
              <span
                className="sidebar-settings-drag-handle"
                title="Drag to reorder"
                aria-hidden="true"
              >
                <GripVertical size={18} />
              </span>
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
              </div>
            </div>
          );
        })}
      </div>

      <section className="sidebar-tool-picker" aria-labelledby="sidebar-tool-picker-title">
        <div>
          <p className="eyebrow">Admin console</p>
          <h3 id="sidebar-tool-picker-title">Add approved tools</h3>
          <p>Choose from the tools available to your role. No custom URLs are allowed.</p>
        </div>
        <div className="sidebar-tool-picker-list">
          {optionalLinks.map((link) => {
            const key = sidebarPreferenceKey(link);
            const alwaysIncluded = defaultKeys.has(key);
            const checked = alwaysIncluded || enabled.has(key);
            return (
              <label
                className={`sidebar-tool-option${alwaysIncluded ? " is-included" : ""}`}
                key={key}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={alwaysIncluded}
                  onChange={() => toggleAdminTool(link)}
                />
                <span className="sidebar-tool-option-icon" aria-hidden="true">
                  <SidebarSettingsIcon name={link.icon} />
                </span>
                <span className="sidebar-tool-option-copy">
                  <strong>{link.label}</strong>
                  <small>{alwaysIncluded ? "Already in your sidebar" : link.href}</small>
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </section>
  );
}
