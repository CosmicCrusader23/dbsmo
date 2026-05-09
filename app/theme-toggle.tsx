"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function getSnapshot(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("mo-theme") as Theme | null) ?? "light";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(async () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    localStorage.setItem("mo-theme", next);
    applyTheme(next);
    window.dispatchEvent(new Event("storage"));
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } catch {}
  }, [theme]);

  // Sync from DB on mount
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data?.user?.theme && (data.user.theme === "light" || data.user.theme === "dark")) {
          localStorage.setItem("mo-theme", data.user.theme);
          applyTheme(data.user.theme);
          window.dispatchEvent(new Event("storage"));
        }
        if (data?.user?.greetingSettings) {
          localStorage.setItem("mo-typewriter-settings", data.user.greetingSettings);
          window.dispatchEvent(new Event("storage"));
        }
      })
      .catch(() => {});
  }, []);


  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme}`}
    >
      {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
