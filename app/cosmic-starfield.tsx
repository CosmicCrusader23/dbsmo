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

type Motion = {
  x: number;
  y: number;
  cursorX: number;
  cursorY: number;
  presence: number;
  press: number;
  yaw: number;
  pitch: number;
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
  motion: Motion,
) {
  const compact = width < 700;
  const coreX = width * (compact ? 0.73 : 0.52) + motion.x * 32;
  const coreY = height * (compact ? 0.21 : 0.48) + motion.y * 24;
  const coreRadius = Math.min(width * (compact ? 0.13 : 0.095), height * 0.17, 104);
  const cosYaw = Math.cos(motion.yaw);
  const sinYaw = Math.sin(motion.yaw);
  const cosPitch = Math.cos(motion.pitch);
  const sinPitch = Math.sin(motion.pitch);
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
    let px = x * width + plume * height + motion.x * (14 + star.size * 4);
    let py = y * height + (star.spread - 0.5) * (18 + 48 * t) + motion.y * (10 + star.size * 3);
    const localX = px - coreX;
    const localY = py - coreY;
    const localZ = (star.spread - 0.5) * height * 0.5;
    const rotatedX = localX * cosYaw + localZ * sinYaw;
    const rotatedZ = localZ * cosYaw - localX * sinYaw;
    const rotatedY = localY * cosPitch - rotatedZ * sinPitch;
    const depth = localY * sinPitch + rotatedZ * cosPitch;
    const perspective = 1 / (1 + depth / (Math.max(width, height) * 2.4));
    px = coreX + rotatedX * perspective;
    py = coreY + rotatedY * perspective;
    const dx = px - motion.cursorX;
    const dy = py - motion.cursorY;
    const distance = Math.hypot(dx, dy);
    const reach = Math.min(width, height) * 0.32;
    const influence = motion.presence * Math.max(0, 1 - distance / reach) ** 2;
    const push = influence * (70 + motion.press * 90);
    if (distance > 0.1) {
      px += (dx / distance) * push;
      py += (dy / distance) * push;
    }
    const fade = Math.min(1, t * 9, (1 - t) * 10);
    drawStar(context, glows, star, px, py, time, fade * (0.82 + influence * 0.7));
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
  motion: Motion,
) {
  const centerX = width * (width < 700 ? 0.68 : 0.74) + motion.x * 7;
  const centerY = height * 0.53 + motion.y * 5;
  const scale = Math.min(width * 0.42, height * 0.82);
  const bloom = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 0.63);
  bloom.addColorStop(0, "#d5e8f35e");
  bloom.addColorStop(0.22, "#90b8d537");
  bloom.addColorStop(1, "#90b8d500");
  context.fillStyle = bloom;
  context.fillRect(centerX - scale, centerY - scale, scale * 2, scale * 2);

  const yaw = motion.yaw + motion.x * 0.13;
  const pitch = motion.pitch + motion.y * 0.09;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  for (const star of stars) {
    const progress = star.seed;
    const angle = progress * Math.PI * 7.4 + time * 0.000055;
    const radius = scale * (0.035 + progress * 0.95);
    const thickness = (2 + progress * 16) * star.offset;
    const localX = Math.cos(angle) * radius - Math.sin(angle) * thickness;
    const localY = Math.sin(angle) * radius * 0.78 + Math.cos(angle) * thickness;
    const localZ = (star.spread - 0.5) * scale * 0.26;
    const rotatedX = localX * cosYaw + localZ * sinYaw;
    const rotatedZ = localZ * cosYaw - localX * sinYaw;
    const rotatedY = localY * cosPitch - rotatedZ * sinPitch;
    const depth = localY * sinPitch + rotatedZ * cosPitch;
    const perspective = 1 / (1 + depth / (scale * 2.7));
    const x = centerX + rotatedX * perspective;
    const y = centerY + rotatedY * perspective;
    const fade = Math.min(1, progress * 8, (1 - progress) * 8);
    drawStar(context, glows, star, x, y, time, fade * 0.95 * Math.min(1.3, perspective));
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
    const surface = host?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !host || !surface || !context) return;

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
    const motion: Motion = {
      x: 0,
      y: 0,
      cursorX: -1000,
      cursorY: -1000,
      presence: 0,
      press: 0,
      yaw: 0,
      pitch: 0,
    };
    const target = { x: 0, y: 0, cursorX: -1000, cursorY: -1000, presence: 0, press: 0 };
    let dragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let yawVelocity = 0;
    let pitchVelocity = 0;

    const paint = (time: number) => {
      context.globalAlpha = 1;
      context.clearRect(0, 0, width, height);
      context.fillStyle = variant === "sol" ? "#030a0e" : "#050b11";
      context.fillRect(0, 0, width, height);
      for (const star of distant) {
        drawStar(
          context,
          glows,
          star,
          star.seed * width + motion.x * (3 + star.size),
          star.spread * height + motion.y * (2 + star.size),
          time,
          0.25,
        );
      }
      context.globalAlpha = 1;
      if (variant === "sol") drawSol(context, glows, stars, width, height, time, motion);
      else drawAstra(context, glows, stars, width, height, time, motion);
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
      if (document.hidden || !visible || reducedMotion.matches) {
        previous = timestamp;
        return;
      }
      if (!pausedRef.current) elapsed += Math.min(timestamp - (previous || timestamp), 48);
      previous = timestamp;
      const ease = dragging ? 0.2 : 0.075;
      motion.x += (target.x - motion.x) * ease;
      motion.y += (target.y - motion.y) * ease;
      motion.cursorX += (target.cursorX - motion.cursorX) * 0.24;
      motion.cursorY += (target.cursorY - motion.cursorY) * 0.24;
      motion.presence += (target.presence - motion.presence) * 0.09;
      motion.press += (target.press - motion.press) * 0.17;
      if (!dragging && !pausedRef.current) {
        motion.yaw += yawVelocity;
        motion.pitch = Math.max(-0.8, Math.min(0.8, motion.pitch + pitchVelocity));
        yawVelocity *= 0.93;
        pitchVelocity *= 0.9;
      }
      if (timestamp - lastPaint < 32) return;
      lastPaint = timestamp;
      paint(elapsed);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    const pointerMove = (event: PointerEvent) => {
      if (reducedMotion.matches) return;
      const bounds = host.getBoundingClientRect();
      target.cursorX = event.clientX - bounds.left;
      target.cursorY = event.clientY - bounds.top;
      target.x = Math.max(-1, Math.min(1, (target.cursorX / width - 0.5) * 2));
      target.y = Math.max(-1, Math.min(1, (target.cursorY / height - 0.5) * 2));
      target.presence = 1;
      if (dragging) {
        const dx = event.clientX - lastPointerX;
        const dy = event.clientY - lastPointerY;
        const sensitivity = variant === "astra" ? 0.006 : 0.003;
        motion.yaw += dx * sensitivity;
        motion.pitch = Math.max(-0.8, Math.min(0.8, motion.pitch + dy * sensitivity * 0.67));
        yawVelocity = Math.max(-0.1, Math.min(0.1, dx * sensitivity * 0.5));
        pitchVelocity = Math.max(-0.06, Math.min(0.06, dy * sensitivity * 0.34));
      }
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    };
    const pointerDown = (event: PointerEvent) => {
      if (reducedMotion.matches) return;
      pointerMove(event);
      target.press = 1;
      const interactive = event.target instanceof Element && event.target.closest("a, button, input, select, textarea");
      if (!interactive) {
        dragging = true;
        yawVelocity = 0;
        pitchVelocity = 0;
        surface.setPointerCapture(event.pointerId);
      }
    };
    const pointerUp = (event: PointerEvent) => {
      target.press = 0;
      dragging = false;
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
      const bounds = host.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        target.x = 0;
        target.y = 0;
        target.presence = 0;
      }
    };
    const pointerLeave = () => {
      if (dragging) return;
      target.x = 0;
      target.y = 0;
      target.presence = 0;
    };
    const arrowKeys = (event: KeyboardEvent) => {
      if (
        reducedMotion.matches ||
        !(event.target instanceof HTMLElement) ||
        !event.target.classList.contains("cosmic-scene__control")
      ) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        motion.yaw += event.key === "ArrowLeft" ? -0.16 : 0.16;
        event.preventDefault();
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        motion.pitch = Math.max(-0.8, Math.min(0.8, motion.pitch + (event.key === "ArrowUp" ? -0.12 : 0.12)));
        event.preventDefault();
      }
    };
    visibility.observe(host);
    surface.addEventListener("pointermove", pointerMove);
    surface.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    surface.addEventListener("pointerleave", pointerLeave);
    surface.addEventListener("keydown", arrowKeys);
    resize();
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      surface.removeEventListener("pointermove", pointerMove);
      surface.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      surface.removeEventListener("pointerleave", pointerLeave);
      surface.removeEventListener("keydown", arrowKeys);
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
        aria-label={`${paused ? "Play" : "Pause"} starfield animation. Drag the starfield to rotate it, or use arrow keys while focused.`}
        title={paused ? "Play animation" : "Pause animation"}
      >
        {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
      </button>
    </div>
  );
}
