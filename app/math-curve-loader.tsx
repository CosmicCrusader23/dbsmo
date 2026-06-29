"use client";

import { animate, createDrawable, stagger } from "animejs";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Point = {
  x: number;
  y: number;
};

type CurveVariant = {
  name: string;
  className: string;
  durationMs: number;
  path: string;
  particles: Point[];
};

type MathCurveLoaderProps = {
  size?: number;
  label?: string;
  className?: string;
};

function buildPath(pointForProgress: (progress: number) => Point, steps = 180) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const point = pointForProgress(index / steps);
    return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

function buildParticles(pointForProgress: (progress: number) => Point, count = 8) {
  return Array.from({ length: count }, (_, index) => pointForProgress(index / count));
}

function rose(k: number, scale: number) {
  return (progress: number) => {
    const t = progress * Math.PI * 2;
    const radius = Math.cos(k * t) * scale;
    return {
      x: 50 + Math.cos(t) * radius,
      y: 50 + Math.sin(t) * radius,
    };
  };
}

function roseOrbit(k: number) {
  return (progress: number) => {
    const t = progress * Math.PI * 2;
    const radius = 21 - 7 * Math.cos(k * t);
    return {
      x: 50 + Math.cos(t) * radius,
      y: 50 + Math.sin(t) * radius,
    };
  };
}

function lissajous(a: number, b: number, phase: number) {
  return (progress: number) => {
    const t = progress * Math.PI * 2;
    return {
      x: 50 + Math.sin(a * t + phase) * 30,
      y: 50 + Math.sin(b * t) * 27,
    };
  };
}

function hypotrochoid() {
  return (progress: number) => {
    const t = progress * Math.PI * 2;
    const r1 = 19;
    const r2 = 7;
    const d = 14;
    return {
      x: 50 + (r1 - r2) * Math.cos(t) + d * Math.cos(((r1 - r2) / r2) * t),
      y: 50 + (r1 - r2) * Math.sin(t) - d * Math.sin(((r1 - r2) / r2) * t),
    };
  };
}

function cardioid() {
  return (progress: number) => {
    const t = progress * Math.PI * 2;
    const radius = 17 * (1 - Math.sin(t));
    return {
      x: 50 + Math.cos(t) * radius,
      y: 56 + Math.sin(t) * radius,
    };
  };
}

function cassini() {
  return (progress: number) => {
    const t = progress * Math.PI * 2;
    const radius = 23 * Math.sqrt(Math.max(0.18, Math.cos(2 * t) + 1.04));
    return {
      x: 50 + Math.cos(t) * radius,
      y: 50 + Math.sin(t) * radius * 0.72,
    };
  };
}

const CURVE_POINTS = [
  { name: "Rose five", className: "rose-five", durationMs: 1400, point: rose(5, 31) },
  { name: "Rose orbit", className: "rose-orbit", durationMs: 1700, point: roseOrbit(7) },
  {
    name: "Lissajous drift",
    className: "lissajous",
    durationMs: 1900,
    point: lissajous(3, 4, 1.57),
  },
  { name: "Hypotrochoid", className: "hypotrochoid", durationMs: 2100, point: hypotrochoid() },
  { name: "Cardioid", className: "cardioid", durationMs: 1600, point: cardioid() },
  { name: "Cassini oval", className: "cassini", durationMs: 1800, point: cassini() },
];

const CURVE_VARIANTS: CurveVariant[] = CURVE_POINTS.map((curve) => ({
  name: curve.name,
  className: curve.className,
  durationMs: curve.durationMs,
  path: buildPath(curve.point),
  particles: buildParticles(curve.point),
}));

export function MathCurveLoader({ size = 18, label = "Loading", className }: MathCurveLoaderProps) {
  const [variantIndex, setVariantIndex] = useState(0);
  const rotorRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotsRef = useRef<SVGCircleElement[]>([]);
  const variant = CURVE_VARIANTS[variantIndex] ?? CURVE_VARIANTS[0];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setVariantIndex(Math.floor(Math.random() * CURVE_VARIANTS.length));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const rotor = rotorRef.current;
    const path = pathRef.current;
    const dots = dotsRef.current;

    if (!rotor || !path || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const [drawable] = createDrawable(path, 0, 0);
    drawable.setAttribute("draw", "0 0");
    const drawAnimation = animate(drawable, {
      draw: "0 1",
      duration: variant.durationMs,
      ease: "inOutSine",
      loop: true,
      alternate: true,
    });
    const spinAnimation = animate(rotor, {
      rotate: "360deg",
      duration: variant.durationMs * 1.7,
      ease: "linear",
      loop: true,
    });
    const dotAnimation = dots.length
      ? animate(dots, {
          scale: [0.5, 1.15],
          opacity: [0.42, 0.9],
          duration: variant.durationMs * 0.7,
          delay: stagger(85, { from: "center" }),
          ease: "inOutSine",
          loop: true,
          alternate: true,
        })
      : null;

    return () => {
      drawAnimation.revert();
      spinAnimation.revert();
      dotAnimation?.revert();
    };
  }, [variant]);

  return (
    <span
      aria-label={label}
      className={["math-curve-loader", className].filter(Boolean).join(" ")}
      role="status"
      style={
        {
          "--loader-size": `${size}px`,
        } as CSSProperties
      }
      title={variant.name}
    >
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <g className="math-curve-loader-rotor" ref={rotorRef}>
          <path className="math-curve-loader-track" d={variant.path} pathLength={100} />
          <path
            className="math-curve-loader-path"
            d={variant.path}
            pathLength={100}
            ref={pathRef}
          />
          {variant.particles.map((point, index) => (
            <circle
              className={`math-curve-loader-dot ${variant.className}`}
              cx={point.x}
              cy={point.y}
              key={`${variant.name}-${index}`}
              ref={(node) => {
                if (node) dotsRef.current[index] = node;
              }}
              r={index === 0 ? 4.6 : 2.8}
            />
          ))}
        </g>
      </svg>
    </span>
  );
}
