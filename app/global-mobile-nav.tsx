"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const OPEN_CLASS = "mobile-nav-open";
const CLOSE_EVENT = "dbsmo:mobile-nav-close";
const SIDEBAR_ID = "site-sidebar-navigation";
const MOBILE_NAV_QUERY = "(max-width: 1050px)";

export function GlobalMobileNavToggle() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const sidebar = document.getElementById(SIDEBAR_ID);
    const content = document.querySelector<HTMLElement>(".site-content");
    const footer = document.querySelector<HTMLElement>(".app-footer");
    const mobileQuery = window.matchMedia(MOBILE_NAV_QUERY);

    if (!open && wasOpenRef.current && sidebar?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }

    const sync = () => {
      const modalOpen = mobileQuery.matches && open;
      const sidebarHidden = mobileQuery.matches && !open;

      root.classList.toggle(OPEN_CLASS, modalOpen);
      if (sidebar) {
        sidebar.inert = sidebarHidden;
        if (sidebarHidden) sidebar.setAttribute("aria-hidden", "true");
        else sidebar.removeAttribute("aria-hidden");
      }
      if (content) content.inert = modalOpen;
      if (footer) footer.inert = modalOpen;
    };

    const handleViewportChange = () => {
      sync();
      if (!mobileQuery.matches) setOpen(false);
    };

    sync();
    mobileQuery.addEventListener("change", handleViewportChange);
    wasOpenRef.current = open;

    return () => {
      mobileQuery.removeEventListener("change", handleViewportChange);
      root.classList.remove(OPEN_CLASS);
      if (sidebar) {
        sidebar.inert = false;
        sidebar.removeAttribute("aria-hidden");
      }
      if (content) content.inert = false;
      if (footer) footer.inert = false;
    };
  }, [open]);

  useEffect(() => {
    function close() {
      setOpen(false);
    }
    window.addEventListener("popstate", close);
    window.addEventListener(CLOSE_EVENT, close);
    return () => {
      window.removeEventListener("popstate", close);
      window.removeEventListener(CLOSE_EVENT, close);
    };
  }, []);

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
        ref={toggleRef}
        type="button"
        className="mobile-topbar-toggle"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-controls={SIDEBAR_ID}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
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
      onClick={() => window.dispatchEvent(new Event(CLOSE_EVENT))}
    />
  );
}
