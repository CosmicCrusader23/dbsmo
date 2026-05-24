"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const OPEN_CLASS = "mobile-nav-open";

export function GlobalMobileNavToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      root.classList.add(OPEN_CLASS);
    } else {
      root.classList.remove(OPEN_CLASS);
    }
    return () => {
      root.classList.remove(OPEN_CLASS);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    window.addEventListener("popstate", close);
    return () => {
      window.removeEventListener("popstate", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="mobile-topbar" role="banner">
      <Link href="/dashboard" className="mobile-topbar-brand" onClick={() => setOpen(false)}>
        DBSMO
      </Link>
      <button
        type="button"
        className="mobile-topbar-toggle"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
    </header>
  );
}

export function GlobalMobileNavScrim() {
  return (
    <button
      type="button"
      className="mobile-nav-scrim"
      tabIndex={-1}
      aria-hidden="true"
      onClick={() => document.documentElement.classList.remove(OPEN_CLASS)}
    />
  );
}
