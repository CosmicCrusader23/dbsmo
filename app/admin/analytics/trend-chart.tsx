"use client";

import { useMemo, useRef, useState } from "react";

type TrendPoint = {
  label: string;
  fullLabel: string;
  attempts: number;
  completions: number;
  avgPct: number;
};

const CHART_W = 760;
const CHART_H = 320;
const PAD_L = 44;
const PAD_R = 18;
const PAD_T = 14;
const PAD_B = 30;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => d.attempts));
  const stepX = data.length > 1 ? PLOT_W / (data.length - 1) : 0;
  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: PAD_L + i * stepX,
        y: PAD_T + PLOT_H - (d.attempts / max) * PLOT_H,
        d,
        i,
      })),
    [data, stepX, max],
  );

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length === 0
      ? ""
      : `${linePath} L${points[points.length - 1].x.toFixed(1)} ${PAD_T + PLOT_H} L${points[0].x.toFixed(1)} ${PAD_T + PLOT_H} Z`;

  const yTicks = (() => {
    const step = Math.max(1, Math.ceil(max / 4));
    const ticks: number[] = [];
    for (let v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    return ticks;
  })();

  const xTickIndices = (() => {
    const len = data.length;
    if (len <= 8) return data.map((_, i) => i);
    const target = 6;
    const stride = Math.max(1, Math.ceil((len - 1) / (target - 1)));
    const idxs: number[] = [];
    for (let i = 0; i < len; i += stride) idxs.push(i);
    if (idxs[idxs.length - 1] !== len - 1) idxs.push(len - 1);
    return idxs;
  })();

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const wrap = wrapRef.current;
    if (!wrap || data.length === 0) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const xInView = ratio * CHART_W;
    let nearest = 0;
    let best = Infinity;
    for (const p of points) {
      const dx = Math.abs(p.x - xInView);
      if (dx < best) {
        best = dx;
        nearest = p.i;
      }
    }
    setHover(nearest);
  }

  const hovered = hover !== null ? points[hover] : null;
  const tooltipPct =
    hovered && wrapRef.current
      ? Math.max(0, Math.min(100, ((hovered.x - PAD_L) / PLOT_W) * 100))
      : 0;

  return (
    <div className="trend-chart-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Attempts over time"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pink)" stopOpacity="0.45" />
            <stop offset="55%" stopColor="var(--color-pink)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-pink)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => {
          const y = PAD_T + PLOT_H - (v / max) * PLOT_H;
          return (
            <g key={v}>
              <line
                x1={PAD_L}
                x2={PAD_L + PLOT_W}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
                opacity={0.55}
              />
              <text
                x={PAD_L - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--color-muted)"
                fontSize={11}
                fontWeight={700}
              >
                {v}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#trendArea)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-pink)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p) => (
          <circle
            key={p.i}
            cx={p.x}
            cy={p.y}
            r={hover === p.i ? 5 : 3}
            fill={hover === p.i ? "var(--color-pink)" : "var(--color-card-bg)"}
            stroke="var(--color-pink)"
            strokeWidth={2}
          />
        ))}

        {xTickIndices.map((i) => {
          const p = points[i];
          if (!p) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={CHART_H - 8}
              textAnchor="middle"
              fill="var(--color-muted)"
              fontSize={11}
              fontWeight={700}
            >
              {p.d.label}
            </text>
          );
        })}

        {hovered ? (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PAD_T}
            y2={PAD_T + PLOT_H}
            stroke="var(--color-pink)"
            strokeOpacity="0.4"
            strokeDasharray="4 4"
          />
        ) : null}
      </svg>

      {hovered ? (
        <div
          className="trend-tooltip"
          style={{
            left: `${tooltipPct}%`,
          }}
        >
          <div className="trend-tooltip-date">{hovered.d.fullLabel}</div>
          <div className="trend-tooltip-row">
            <span className="trend-tooltip-dot" />
            <span>{hovered.d.attempts} attempts</span>
          </div>
          <div className="trend-tooltip-meta">
            {hovered.d.completions} completions · {hovered.d.avgPct}% avg
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { TrendPoint };
