"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileJson,
  Gauge,
  GraduationCap,
  ListChecks,
  MessageSquareText,
  MessageSquareWarning,
  PenLine,
  Settings,
  Sparkles,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { activeSidebarHref, type SidebarNavLink } from "@/lib/sidebar-navigation";

type SidebarLink = Omit<SidebarNavLink, "icon"> & {
  icon: keyof typeof ICON_MAP;
};

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
  BarChart3,
  MessageSquareText,
  MessageSquareWarning,
  CheckCircle2,
  User,
  Trophy,
  Settings,
};

export function SiteSidebarNav({ links }: { links: SidebarLink[] }) {
  const pathname = usePathname() ?? "/";
  const navRef = useRef<HTMLElement | null>(null);
  const activeHref = activeSidebarHref(pathname, links);

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
      {links.map((link) => {
        const Icon = ICON_MAP[link.icon];
        const isActive = activeHref === link.href;
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            key={link.href}
            className={`nav-item${isActive ? " active" : ""}`}
            href={link.href}
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
