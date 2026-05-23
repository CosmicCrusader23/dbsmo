"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileJson,
  Gauge,
  ListChecks,
  MessageSquareWarning,
  PenLine,
  Settings,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

type SidebarLink = {
  href: string;
  label: string;
  icon: keyof typeof ICON_MAP;
  match?: string;
};

const ICON_MAP: Record<string, LucideIcon> = {
  Gauge,
  ClipboardList,
  Target,
  Swords,
  ListChecks,
  PenLine,
  FileJson,
  Users,
  BarChart3,
  MessageSquareWarning,
  CheckCircle2,
  User,
  Trophy,
  Settings,
};

export function SiteSidebarNav({ links }: { links: SidebarLink[] }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="nav-list">
      {links.map((link) => {
        const Icon = ICON_MAP[link.icon];
        const matchPrefix = link.match ?? link.href;
        const isActive =
          pathname === link.href ||
          (matchPrefix !== "/" && pathname.startsWith(matchPrefix));
        return (
          <Link
            key={link.href}
            className={`nav-item${isActive ? " active" : ""}`}
            href={link.href}
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
