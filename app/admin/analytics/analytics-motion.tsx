"use client";

import { animate, stagger } from "animejs";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AnalyticsMotion({
  scopeSelector = ".analytics-frame",
}: {
  scopeSelector?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? "";

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const root = document.querySelector(scopeSelector);
    if (!root) {
      return;
    }

    const fills = Array.from(root.querySelectorAll<HTMLElement>(".meter-fill, .score-dist-fill"));
    const dailyBars = Array.from(root.querySelectorAll<HTMLElement>(".daily-bar span"));
    const accuracyCards = Array.from(root.querySelectorAll<HTMLElement>(".accuracy-card"));

    const fillAnimations = fills.map((fill, index) => {
      const targetWidth = fill.style.width || "100%";
      fill.style.width = "0%";
      return animate(fill, {
        width: targetWidth,
        duration: 740,
        delay: 90 + index * 28,
        ease: "outExpo",
      });
    });

    const dailyAnimations = dailyBars.map((bar, index) => {
      const targetHeight = bar.style.height || "100%";
      bar.style.transformOrigin = "bottom";
      bar.style.height = "0%";
      return animate(bar, {
        height: targetHeight,
        scaleY: [{ from: 0.82, to: 1 }],
        duration: 680,
        delay: 120 + index * 14,
        ease: "outCubic",
      });
    });

    const cardAnimation =
      accuracyCards.length > 0
        ? animate(accuracyCards, {
            opacity: [{ from: 0, to: 1 }],
            translateY: [{ from: 14, to: 0 }],
            scale: [{ from: 0.96, to: 1 }],
            duration: 520,
            delay: stagger(38, { start: 140 }),
            ease: "outBack(1.35)",
          })
        : null;

    return () => {
      for (const animation of [...fillAnimations, ...dailyAnimations]) {
        animation.revert();
      }
      cardAnimation?.revert();
    };
  }, [pathname, scopeSelector, searchKey]);

  return null;
}
