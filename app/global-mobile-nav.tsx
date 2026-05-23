"use client";

import { useEffect, useState } from "react";
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

  return (
    <button
      type="button"
      className="mobile-nav-toggle global-mobile-nav-toggle"
      aria-label={open ? "Close navigation" : "Open navigation"}
      aria-expanded={open}
      onClick={() => setOpen((prev) => !prev)}
    >
      {open ? <X size={20} /> : <Menu size={20} />}
    </button>
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
