"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

type Variant = "sol" | "astra";

type Star = {
  seed: number;
  offset: number;
  spread: number;
  size: number;
  color: number;
  phase: number;
};

const COLORS = ["#f8f7ef", "#abd8f6", "#eaa16d"];

function randomGenerator(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeStars(variant: Variant, count: number) {
  const random = randomGenerator(variant === "sol" ? 6121 : 6199);
  return Array.from({ length: count }, () => ({
    seed: random(),
    offset: random() * 2 - 1,
    spread: random(),
    size: 0.45 + Math.pow(random(), 5) * 4.6,
    color: random() < 0.58 ? 0 : random() < 0.7 ? 1 : 2,
    phase: random() * Math.PI * 2,
  }));
}

function makeGlow(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 48;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const gradient = context.createRadialGradient(24, 24, 0, 24, 24, 24);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.09, color);
  gradient.addColorStop(0.22, `${color}99`);
  gradient.addColorStop(0.48, `${color}25`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 48, 48);
  return canvas;
}

function drawStar(
  context: CanvasRenderingContext2D,
  glows: HTMLCanvasElement[],
  star: Star,
  x: number,
  y: number,
  time: number,
  intensity: number,
) {
  const twinkle = 0.75 + 0.25 * Math.sin(time * 0.0017 + star.phase);
  const radius = star.size * (star.size > 2.5 ? 2.5 : 1.9);
  context.globalAlpha = intensity * twinkle;
  context.drawImage(glows[star.color], x - radius, y - radius, radius * 2, radius * 2);
  if (star.size > 2.5) {
    context.fillStyle = COLORS[star.color];
    context.beginPath();
    context.arc(x, y, Math.max(0.65, star.size * 0.32), 0, Math.PI * 2);
    context.fill();
  }
}

function drawSol(
  context: CanvasRenderingContext2D,
  glows: HTMLCanvasElement[],
  stars: Star[],
  width: number,
  height: number,
  time: number,
) {
  const compact = width < 700;
  const coreX = width * (compact ? 0.73 : 0.52);
  const coreY = height * (compact ? 0.21 : 0.48);
  const coreRadius = Math.min(width * (compact ? 0.13 : 0.095), height * 0.17, 104);
  const halo = context.createRadialGradient(coreX, coreY, coreRadius * 0.7, coreX, coreY, coreRadius * 3.7);
  halo.addColorStop(0, "#f6cf77a6");
  halo.addColorStop(0.28, "#d58a3452");
  halo.addColorStop(1, "#d58a3400");
  context.fillStyle = halo;
  context.fillRect(coreX - coreRadius * 3.7, coreY - coreRadius * 3.7, coreRadius * 7.4, coreRadius * 7.4);

  for (const star of stars) {
    const t = (star.seed + time * 0.000004) % 1;
    const inv = 1 - t;
    // A broad comet stream bends around the core, then drops out of frame.
    const x =
      inv * inv * inv * -0.12 +
      3 * inv * inv * t * 0.42 +
      3 * inv * t * t * 0.77 +
      t * t * t * 0.57;
    const y =
      inv * inv * inv * 0.11 +
      3 * inv * inv * t * 0.04 +
      3 * inv * t * t * 0.12 +
      t * t * t * 1.08;
    const plume = (0.017 + 0.08 * Math.sin(Math.PI * t) ** 2) * star.offset;
    const px = x * width + plume * height;
    const py = y * height + (star.spread - 0.5) * (18 + 48 * t);
    const fade = Math.min(1, t * 9, (1 - t) * 10);
    drawStar(context, glows, star, px, py, time, fade * 0.82);
  }

  const coreGlow = context.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreRadius);
  coreGlow.addColorStop(0, "#fffdf0");
  coreGlow.addColorStop(0.78, "#fff8d5");
  coreGlow.addColorStop(1, "#f3d98e");
  context.globalAlpha = 1;
  context.fillStyle = coreGlow;
  context.beginPath();
  context.arc(coreX, coreY, coreRadius, 0, Math.PI * 2);
  context.fill();
}

function drawAstra(
  context: CanvasRenderingContext2D,
  glows: HTMLCanvasElement[],
  stars: Star[],
  width: number,
  height: number,
  time: number,
) {
  const centerX = width * (width < 700 ? 0.68 : 0.74);
  const centerY = height * 0.53;
  const scale = Math.min(width * 0.42, height * 0.82);
  const bloom = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 0.63);
  bloom.addColorStop(0, "#d5e8f35e");
  bloom.addColorStop(0.22, "#90b8d537");
  bloom.addColorStop(1, "#90b8d500");
  context.fillStyle = bloom;
  context.fillRect(centerX - scale, centerY - scale, scale * 2, scale * 2);

  for (const star of stars) {
    const progress = star.seed;
    const angle = progress * Math.PI * 7.4 + time * 0.000055;
    const radius = scale * (0.035 + progress * 0.95);
    const thickness = (2 + progress * 16) * star.offset;
    const x = centerX + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * thickness;
    const y = centerY + Math.sin(angle) * radius * 0.78 + Math.sin(angle + Math.PI / 2) * thickness;
    const fade = Math.min(1, progress * 8, (1 - progress) * 8);
    drawStar(context, glows, star, x, y, time, fade * 0.95);
  }
  context.globalAlpha = 1;
}

export function CosmicStarfield({ variant }: { variant: Variant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !host || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stars = makeStars(variant, variant === "sol" ? 860 : 760);
    const distant = makeStars(variant === "sol" ? "astra" : "sol", 90);
    const glows = COLORS.map(makeGlow);
    let width = 1;
    let height = 1;
    let frame = 0;
    let elapsed = 0;
    let previous = 0;
    let lastPaint = 0;
    let visible = true;

    const paint = (time: number) => {
      context.globalAlpha = 1;
      context.clearRect(0, 0, width, height);
      context.fillStyle = variant === "sol" ? "#030a0e" : "#050b11";
      context.fillRect(0, 0, width, height);
      for (const star of distant) {
        drawStar(context, glows, star, star.seed * width, star.spread * height, time, 0.25);
      }
      context.globalAlpha = 1;
      if (variant === "sol") drawSol(context, glows, stars, width, height, time);
      else drawAstra(context, glows, stars, width, height, time);
      context.globalAlpha = 1;
    };

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      paint(elapsed);
    };

    const animate = (timestamp: number) => {
      frame = window.requestAnimationFrame(animate);
      if (document.hidden || !visible || pausedRef.current || reducedMotion.matches) {
        previous = timestamp;
        return;
      }
      elapsed += Math.min(timestamp - (previous || timestamp), 48);
      previous = timestamp;
      if (timestamp - lastPaint < 32) return;
      lastPaint = timestamp;
      paint(elapsed);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    visibility.observe(host);
    resize();
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
    };
  }, [variant]);

  return (
    <div className={`cosmic-scene cosmic-scene--${variant}`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <button
        className="cosmic-scene__control"
        type="button"
        onClick={() => {
          pausedRef.current = !pausedRef.current;
          setPaused(pausedRef.current);
        }}
        aria-label={paused ? "Play starfield animation" : "Pause starfield animation"}
        title={paused ? "Play animation" : "Pause animation"}
      >
        {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
      </button>
    </div>
  );
}
