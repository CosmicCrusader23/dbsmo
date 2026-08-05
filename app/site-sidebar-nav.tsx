"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  BookOpen,
  ClipboardList,
  Code2,
  FileJson,
  FileText,
  Gauge,
  Globe2,
  GraduationCap,
  LayoutGrid,
  Link2,
  ListChecks,
  MessageSquareText,
  MessageSquareWarning,
  PenLine,
  Settings,
  Star,
  Sparkles,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { activeSidebarHref, type SidebarNavLink } from "@/lib/sidebar-navigation";
import {
  EMPTY_SIDEBAR_PREFERENCES,
  SIDEBAR_PREFERENCES_EVENT,
  readSidebarPreferences,
  visibleSidebarLinks,
} from "@/lib/sidebar-preferences";

type SidebarLink = SidebarNavLink;

const ICON_MAP: Record<string, LucideIcon> = {
  Gauge,
  ClipboardList,
  Target,
  Swords,
  Sparkles,
  ListChecks,
  PenLine,
  FileJson,
  Users,
  GraduationCap,
  LayoutGrid,
  BarChart3,
  MessageSquareText,
  MessageSquareWarning,
  CheckCircle2,
  User,
  Trophy,
  Settings,
  BookOpen,
  Code2,
  FileText,
  Globe2,
  Link2,
  Star,
};

export function SiteSidebarNav({
  links,
  optionalLinks = [],
  initialPreferences,
  userId,
}: {
  links: SidebarLink[];
  optionalLinks?: SidebarLink[];
  initialPreferences: typeof EMPTY_SIDEBAR_PREFERENCES;
  userId: string;
}) {
  const pathname = usePathname() ?? "/";
  const navRef = useRef<HTMLElement | null>(null);
  const [preferences, setPreferences] = useState(initialPreferences);
  const visibleLinks = visibleSidebarLinks(links, preferences, optionalLinks);
  const activeHref = activeSidebarHref(pathname, visibleLinks);

  useEffect(() => {
    const update = () => setPreferences((current) => readSidebarPreferences(userId, current));
    window.addEventListener("storage", update);
    window.addEventListener(SIDEBAR_PREFERENCES_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(SIDEBAR_PREFERENCES_EVENT, update);
    };
  }, [userId]);

  useEffect(() => {
    const sidebar = navRef.current?.closest(".sidebar") as HTMLElement | null;
    if (!sidebar) return;
    function collapse() {
      const active = document.activeElement as HTMLElement | null;
      if (active && sidebar?.contains(active) && typeof active.blur === "function") {
        active.blur();
      }
    }
    sidebar.addEventListener("mouseleave", collapse);
    return () => {
      sidebar.removeEventListener("mouseleave", collapse);
    };
  }, []);

  return (
    <nav className="nav-list" ref={navRef}>
      {visibleLinks.map((link) => {
        const Icon = ICON_MAP[link.icon] ?? Link2;
        const isActive = activeHref === link.href;
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            key={link.preferenceKey ?? link.href}
            className={`nav-item${isActive ? " active" : ""}`}
            href={link.href}
            rel={link.external ? "noreferrer" : undefined}
            target={link.external ? "_blank" : undefined}
            onClick={(e) => {
              e.currentTarget.blur();
              window.dispatchEvent(new Event("dbsmo:mobile-nav-close"));
            }}
          >
            <Icon size={18} />
            <span className="nav-label">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export type { SidebarLink };
