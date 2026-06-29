"use client";

import { animate, stagger } from "animejs";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const ANIMATED_SELECTORS = [
  ".topbar",
  ".dashboard-announcement",
  ".dashboard-stat",
  ".quick-card",
  ".panel",
  ".classes-card",
  ".student-class-card",
  ".classes-announcement-card",
  ".problem-set-row",
  ".set-card",
  ".profile-set-card",
  ".authored-task-row",
  ".writeup-post",
  ".leaderboard-row",
  ".metric-card",
  ".secondary-action",
  ".primary-action",
].join(", ");

export function AnimeRouteEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const root = document.querySelector(".site-content");
    if (!root) {
      return;
    }

    const targets = Array.from(root.querySelectorAll<HTMLElement>(ANIMATED_SELECTORS))
      .filter((element) => element.offsetParent !== null)
      .slice(0, 70);

    if (targets.length === 0) {
      return;
    }

    const routeReveal = animate(targets, {
      opacity: [{ from: 0, to: 1 }],
      translateY: [{ from: 12, to: 0 }],
      scale: [{ from: 0.985, to: 1 }],
      duration: 460,
      delay: stagger(32, { start: 35 }),
      ease: "outQuint",
    });

    return () => {
      routeReveal.revert();
    };
  }, [pathname]);

  return null;
}
