"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

type Variant = "sol" | "astra";

type Star = {
  seed: number;
  offset: number;
  spread: number;
  size: number;
  color: number;
  phase: number;
  scatterX: number;
  scatterY: number;
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

const COLORS = ["#f8faff", "#9fd6fb", "#efaa77"];

function smoothstep(start: number, end: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function cubic(a: number, b: number, c: number, d: number, t: number) {
  const s = 1 - t;
  return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
}

function solPath(t: number) {
  if (t < 0.59) {
    const u = t / 0.59;
    return { x: cubic(-0.08, 0.27, 0.65, 0.7, u), y: cubic(0.1, 0.035, 0.13, 0.33, u) };
  }
  const u = (t - 0.59) / 0.41;
  return { x: cubic(0.7, 0.78, 0.7, 0.62, u), y: cubic(0.33, 0.55, 0.94, 1.12, u) };
}

function randomGenerator(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeStars(variant: Variant, count: number) {
  const random = randomGenerator(variant === "sol" ? 6121 : 6199);
  return Array.from({ length: count }, () => {
    const bright = random();
    const color = random();
    return {
      seed: random(),
      offset: Math.sqrt(-2 * Math.log(Math.max(0.00001, random()))) * Math.cos(2 * Math.PI * random()),
      spread: Math.sqrt(-2 * Math.log(Math.max(0.00001, random()))) * Math.cos(2 * Math.PI * random()),
      size: bright < 0.012 ? 2.8 + random() * 2.8 : bright < 0.1 ? 1.15 + random() * 1.6 : 0.3 + random() * 0.75,
      color: color < 0.52 ? 0 : color < 0.83 ? 1 : 2,
      phase: random() * Math.PI * 2,
      scatterX: random(),
      scatterY: random(),
    };
  });
}

function makeGlow(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.09, `${color}b8`);
  gradient.addColorStop(0.28, `${color}4a`);
  gradient.addColorStop(0.62, `${color}0a`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
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
  if (intensity < 0.015) return;
  const twinkle = 0.84 + 0.16 * Math.sin(time * 0.0016 + star.phase);
  context.globalAlpha = Math.min(1, intensity * twinkle);
  if (star.size > 1.05) {
    const radius = star.size * (star.size > 2.8 ? 5.4 : 4);
    context.drawImage(glows[star.color], x - radius, y - radius, radius * 2, radius * 2);
  }
  context.fillStyle = COLORS[star.color];
  if (star.size < 1.15) context.fillRect(x, y, Math.max(0.45, star.size), Math.max(0.45, star.size));
  else {
    context.beginPath();
    context.arc(x, y, Math.max(0.55, star.size * 0.46), 0, Math.PI * 2);
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
  reduced: boolean,
) {
  const compact = width < 900;
  const coreX = width * (compact ? 0.67 : 0.48);
  const coreY = height * (compact ? 0.26 : 0.48);
  const coreRadius = Math.min(width * (compact ? 0.11 : 0.075), height * 0.135, 112);
  const opening = reduced ? 1 : smoothstep(0, 2900, time);
  const streamHead = reduced ? 1.2 : -0.08 + smoothstep(80, 3600, time) * 1.28;
  context.globalCompositeOperation = "lighter";

  for (const star of stars) {
    const t = (star.seed + time * 0.0000018) % 1;
    if (t > streamHead) continue;
    const path = solPath(t);
    let px = path.x * width + star.offset * (0.018 + 0.05 * Math.sin(t * Math.PI) ** 2) * height;
    let py = path.y * height + star.spread * (7 + 35 * t);
    px += Math.sin(motion.yaw) * star.spread * 9;
    py += Math.sin(motion.pitch) * star.offset * 9;
    const dx = px - motion.cursorX;
    const dy = py - motion.cursorY;
    const distance = Math.hypot(dx, dy);
    const reach = Math.min(width * 0.28, 290);
    const influence = motion.presence * smoothstep(reach, 0, distance);
    if (distance > 0.5 && influence > 0) {
      const twist = influence * (22 + 32 * motion.press);
      px += (dx / distance) * influence * (45 + 65 * motion.press) - (dy / distance) * twist;
      py += (dy / distance) * influence * (45 + 65 * motion.press) + (dx / distance) * twist;
    }
    const fade = smoothstep(0.015, 0.12, t) * (1 - smoothstep(0.87, 1, t));
    const head = reduced ? 1 : 1 - smoothstep(streamHead - 0.06, streamHead + 0.04, t);
    drawStar(context, glows, star, px, py, time, fade * head * (0.74 + influence * 0.55));
  }

  const halo = context.createRadialGradient(coreX, coreY, coreRadius * 0.45, coreX, coreY, coreRadius * 2.35);
  halo.addColorStop(0, `rgba(255, 213, 116, ${0.6 * opening})`);
  halo.addColorStop(0.3, `rgba(223, 137, 39, ${0.29 * opening})`);
  halo.addColorStop(1, "rgba(223, 137, 39, 0)");
  context.globalAlpha = 1;
  context.fillStyle = halo;
  context.fillRect(coreX - coreRadius * 2.35, coreY - coreRadius * 2.35, coreRadius * 4.7, coreRadius * 4.7);
  context.globalCompositeOperation = "source-over";
  const coreGlow = context.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreRadius);
  coreGlow.addColorStop(0, opening < 0.2 ? "#4a4f50" : "#fffdf0");
  coreGlow.addColorStop(0.87, opening < 0.2 ? "#484b4b" : "#fff9d9");
  coreGlow.addColorStop(1, opening < 0.2 ? "#3e4243" : "#f4d58b");
  context.globalAlpha = 0.28 + opening * 0.72;
  context.fillStyle = coreGlow;
  context.beginPath();
  context.arc(coreX, coreY, coreRadius * (0.84 + opening * 0.16), 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawAstra(
  context: CanvasRenderingContext2D,
  glows: HTMLCanvasElement[],
  stars: Star[],
  width: number,
  height: number,
  time: number,
  motion: Motion,
  reduced: boolean,
) {
  const centerX = width * 0.6;
  const centerY = height * 0.55;
  const scale = Math.min(width * 0.38, height * 0.96);
  const gathering = reduced ? 1 : smoothstep(200, 1850, time);
  const yaw = motion.yaw + time * 0.000035;
  const pitch = motion.pitch;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  context.globalCompositeOperation = "lighter";
  for (const star of stars) {
    const progress = star.seed;
    const angle = -0.3 - progress * Math.PI * 6.35;
    const radius = scale * (0.024 + 0.94 * Math.pow(progress, 0.87));
    const thickness = (2.2 + progress * 12) * star.offset;
    const localX = Math.cos(angle) * radius - Math.sin(angle) * thickness;
    const localY = Math.sin(angle) * radius * 0.77 + Math.cos(angle) * thickness;
    const localZ = star.spread * (9 + 22 * progress) + progress * progress * scale * 0.15;
    const rotatedX = localX * cosYaw + localZ * sinYaw;
    const rotatedZ = localZ * cosYaw - localX * sinYaw;
    const rotatedY = localY * cosPitch - rotatedZ * sinPitch;
    const depth = localY * sinPitch + rotatedZ * cosPitch;
    const perspective = Math.max(0.7, Math.min(1.55, 1 / (1 + depth / (scale * 2.2))));
    const targetX = centerX + rotatedX * perspective;
    const targetY = centerY + rotatedY * perspective;
    const stagger = reduced ? 1 : smoothstep(0, 1, gathering * 1.3 - progress * 0.3);
    const x = star.scatterX * width + (targetX - star.scatterX * width) * stagger;
    const y = star.scatterY * height + (targetY - star.scatterY * height) * stagger;
    const fade = smoothstep(0.005, 0.07, progress) * (1 - smoothstep(0.96, 1, progress));
    drawStar(context, glows, star, x, y, time, fade * (0.77 + 0.23 * perspective));
  }
  const bloom = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 0.42);
  bloom.addColorStop(0, `rgba(235, 247, 255, ${0.77 * gathering})`);
  bloom.addColorStop(0.1, `rgba(202, 229, 255, ${0.35 * gathering})`);
  bloom.addColorStop(1, "rgba(150, 201, 239, 0)");
  context.globalAlpha = 1;
  context.fillStyle = bloom;
  context.fillRect(centerX - scale * 0.42, centerY - scale * 0.42, scale * 0.84, scale * 0.84);
  context.globalCompositeOperation = "source-over";
}

export function CosmicStarfield({ variant }: { variant: Variant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<() => void>(() => {});
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const surface = host?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !host || !surface || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stars = makeStars(variant, variant === "sol" ? 4200 : 5100);
    const distant = makeStars(variant === "sol" ? "astra" : "sol", variant === "sol" ? 100 : 260);
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
    replayRef.current = () => {
      elapsed = 0;
      pausedRef.current = false;
      setPaused(false);
    };

    const paint = (time: number) => {
      context.globalAlpha = 1;
      context.clearRect(0, 0, width, height);
      context.fillStyle = variant === "sol" ? "#030a0e" : "#050b11";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      for (const star of distant) {
        drawStar(
          context,
          glows,
          star,
          star.scatterX * width,
          star.scatterY * height,
          time,
          0.32,
        );
      }
      context.globalAlpha = 1;
      if (variant === "sol") drawSol(context, glows, stars, width, height, time, motion, reducedMotion.matches);
      else drawAstra(context, glows, stars, width, height, time, motion, reducedMotion.matches);
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
    };

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
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
      if (!pausedRef.current) {
        elapsed += Math.min(timestamp - (previous || timestamp), 48) / (variant === "astra" ? 2.5 : 1);
      }
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
      if (timestamp - lastPaint < 30) return;
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
        const sensitivity = variant === "astra" ? 0.009 : 0.004;
        const horizontalDirection = variant === "astra" ? -1 : 1;
        motion.yaw += dx * sensitivity * horizontalDirection;
        motion.pitch = Math.max(-0.8, Math.min(0.8, motion.pitch + dy * sensitivity * 0.67));
        yawVelocity = Math.max(-0.035, Math.min(0.035, dx * sensitivity * 0.18 * horizontalDirection));
        pitchVelocity = Math.max(-0.02, Math.min(0.02, dy * sensitivity * 0.12));
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
      replayRef.current = () => {};
    };
  }, [variant]);

  return (
    <div className={`cosmic-scene cosmic-scene--${variant}`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      {variant === "sol" ? <button
        className="cosmic-scene__control"
        type="button"
        onClick={() => {
          pausedRef.current = !pausedRef.current;
          setPaused(pausedRef.current);
        }}
        aria-label={`${paused ? "Play" : "Pause"} animation. Drag to move the starfield, or use arrow keys while focused.`}
        title={paused ? "Play animation" : "Pause animation"}
      >
        {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
      </button> : <button
        className="cosmic-scene__control"
        type="button"
        onClick={() => replayRef.current()}
        aria-label="Replay spiral field animation. Drag to rotate, or use arrow keys while focused."
        title="Replay animation"
      ><RotateCcw size={18} /></button>}
    </div>
  );
}
