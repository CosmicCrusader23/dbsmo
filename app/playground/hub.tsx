"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Trophy } from "lucide-react";
import type { Boss } from "@/lib/playground/bosses";

export function PlaygroundHub({ bosses, userId }: { bosses: Boss[]; userId: string }) {
  const [trophies, setTrophies] = useState<Record<string, number>>({});

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const b of bosses) {
      try {
        const raw = localStorage.getItem(`dbsmo:trophy:${userId}:${b.slug}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { wonAt?: number };
          if (parsed?.wonAt) next[b.slug] = parsed.wonAt;
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrophies(next);
  }, [bosses, userId]);

  return (
    <main className="playground-hub-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Boss rush</p>
          <h1>
            <Sparkles size={26} />
            Playground
          </h1>
        </div>
        <div className="topbar-actions">
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
      </header>

      <p className="playground-hub-blurb">
        Win against each boss against their expertises before the
        clock runs out. Every boss you beat earns a trophy.
      </p>

      <section className="playground-hub-grid">
        {bosses.map((boss) => {
          const won = Boolean(trophies[boss.slug]);
          return (
            <Link
              key={boss.slug}
              href={`/playground/${boss.slug}`}
              className={`playground-card difficulty-${boss.difficulty}${won ? " is-won" : ""}`}
            >
              <div className="playground-card-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={boss.icon} alt={boss.name} />
                {won ? (
                  <span className="playground-card-trophy" title={boss.trophyTitle}>
                    <Trophy size={14} />
                  </span>
                ) : null}
              </div>
              <div className="playground-card-body">
                <p className="eyebrow">{boss.eyebrow}</p>
                <h2>{boss.name}</h2>
                <p className="playground-card-desc">{boss.description}</p>
                <div className="playground-card-meta">
                  <span className={`difficulty-chip difficulty-${boss.difficulty}`}>
                    {boss.difficulty.replace("-", " ")}
                  </span>
                  {boss.tags.map((tag) => (
                    <span key={tag} className="playground-card-tag">
                      {tag}
                    </span>
                  ))}
                  <span>⏱ {Math.floor(boss.totalTimeSec / 60)}:{String(boss.totalTimeSec % 60).padStart(2, "0")}</span>
                  <span>{boss.phases.length} phases</span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
