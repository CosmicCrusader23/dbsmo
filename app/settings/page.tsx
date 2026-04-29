"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Save, User, CheckCircle2, AlertCircle, Moon, Sun } from "lucide-react";

const MAX_AVATAR_BYTES = 512 * 1024;
const THEME_STORAGE_KEY = "mo-theme";

type ThemePreference = "light" | "dark";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark";
}

function applyThemePreference(theme: ThemePreference) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new Event("storage"));
}

function getThemeSnapshot(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedTheme) ? storedTheme : "light";
}

function subscribeThemePreference(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function DefaultAvatar() {
  return (
    <div className="default-avatar">
      <span>M</span>
    </div>
  );
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  group: string | null;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const themePreference = useSyncExternalStore<ThemePreference>(
    subscribeThemePreference,
    getThemeSnapshot,
    () => "light",
  );

  function handleAvatarFile(file: File | undefined) {
    setError(null);
    setSuccess(null);

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Profile picture must be an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Profile picture must be under 512 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.onerror = () => setError("Could not read that image file.");
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setDisplayName(data.user.displayName || "");
          setAvatarUrl(data.user.avatarUrl || "");
        }
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    applyThemePreference(themePreference);
  }, [themePreference]);

  function handleThemePreference(theme: ThemePreference) {
    applyThemePreference(theme);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save.");
        return;
      }

      setUser(data.user);
      setSuccess("Settings saved!");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="settings-shell">
        <p className="settings-loading">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="settings-shell">
        <p className="settings-loading">Not signed in.</p>
      </main>
    );
  }

  const currentAvatar = avatarUrl.trim();
  const previewName = displayName.trim() || user.name || "";

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
        </div>
        <Link className="secondary-action" href="/dashboard">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </header>

      {error && (
        <div className="create-set-alert create-set-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="create-set-alert create-set-alert-success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <section className="settings-card">
        <div className="settings-avatar-section">
          <div className="settings-avatar-preview">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt="Profile"
                className="settings-avatar-img"
                onError={() => {
                  setAvatarUrl("");
                  setError("That profile picture could not be loaded.");
                }}
              />
            ) : null}
            {!currentAvatar && <DefaultAvatar />}
          </div>
          <div className="settings-avatar-info">
            <h3>{previewName || "MO Student"}</h3>
            <p className="settings-role-badge">{user.role}</p>
          </div>
        </div>

        <div className="settings-form">
          <div className="settings-row">
            <label>
              <User size={14} />
              Username (email)
            </label>
            <input type="text" value={user.email} readOnly className="settings-readonly" />
            <small className="form-hint">Your username cannot be changed.</small>
          </div>

          <div className="settings-row">
            <label>
              <User size={14} />
              Real name
            </label>
            <input type="text" value={user.name || "—"} readOnly className="settings-readonly" />
            <small className="form-hint">
              You can only change your name by contacting the admin.
            </small>
          </div>

          <div className="settings-row">
            <label>Display name</label>
            <input
              type="text"
              placeholder="Enter a display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
            <small className="form-hint">
              This is shown in greetings, leaderboards, and your profile. Max 50 characters.
            </small>
          </div>

          <div className="settings-row">
            <label>Profile picture</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => handleAvatarFile(e.target.files?.[0])}
            />
            <small className="form-hint">Upload an image under 512 KB.</small>
          </div>

          <div className="settings-row">
            <label>Profile picture URL</label>
            <input
              type="url"
              placeholder="https://example.com/avatar.png"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            <small className="form-hint">
              Paste a URL or leave this empty for the default M avatar.
            </small>
          </div>

          <div className="settings-row">
            <label>Theme</label>
            <div className="theme-choice" role="group" aria-label="Theme preference">
              <button
                className={`theme-choice-button ${themePreference === "light" ? "active" : ""}`}
                type="button"
                aria-pressed={themePreference === "light"}
                onClick={() => handleThemePreference("light")}
              >
                <Sun size={16} />
                Light
              </button>
              <button
                className={`theme-choice-button ${themePreference === "dark" ? "active" : ""}`}
                type="button"
                aria-pressed={themePreference === "dark"}
                onClick={() => handleThemePreference("dark")}
              >
                <Moon size={16} />
                Dark
              </button>
            </div>
            <small className="form-hint">Saved on this browser.</small>
          </div>

          {avatarUrl ? (
            <button
              className="secondary-action compact settings-clear-avatar"
              type="button"
              onClick={() => setAvatarUrl("")}
            >
              Use default M avatar
            </button>
          ) : null}

          {user.group && (
            <div className="settings-row">
              <label>Group</label>
              <input type="text" value={user.group} readOnly className="settings-readonly" />
            </div>
          )}

          <button className="primary-action settings-save" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>
    </main>
  );
}
