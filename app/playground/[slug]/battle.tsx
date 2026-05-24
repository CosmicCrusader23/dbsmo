"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import katex from "katex";
import { ArrowLeft, Heart, Trophy } from "lucide-react";
import type { Boss, Phase } from "@/lib/playground/bosses";
import { isCorrect } from "@/lib/playground/bosses";

type GameState =
  | { kind: "intro"; line: number }
  | { kind: "dodging"; phase: number; tStart: number; tauntIndex: number }
  | { kind: "challenge"; phase: number; line: number }
  | { kind: "solving"; phase: number; integralIndex: number; tStart: number; input: string; hintShown: boolean; wrong: boolean }
  | { kind: "between"; phase: number }
  | { kind: "victory"; line: number }
  | { kind: "defeat"; line: number };

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
  kind: "round" | "bone" | "laser";
  born: number;
}

const BOX_W = 520;
const BOX_H = 280;
const PLAYER_R = 7;
const PLAYER_SPEED = 220; // px/s

function trophyKey(slug: string) {
  return `dbsmo:trophy:${slug}`;
}

export function BossBattle({ boss }: { boss: Boss }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<GameState>({ kind: "intro", line: 0 });
  const [hp, setHp] = useState(boss.maxHp);
  const [clock, setClock] = useState(boss.totalTimeSec);
  const [phaseIndex, setPhaseIndex] = useState(0);

  const stateRef = useRef(state);
  const hpRef = useRef(hp);
  const clockRef = useRef(clock);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    hpRef.current = hp;
  }, [hp]);
  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);

  const player = useRef({ x: BOX_W / 2, y: BOX_H / 2 });
  const keys = useRef<Record<string, boolean>>({});
  const bullets = useRef<Bullet[]>([]);
  const lastSpawn = useRef<number>(0);
  const invulnUntil = useRef<number>(0);
  const lastFrame = useRef<number>(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const totalElapsed = useRef<number>(0);

  const startPhase = useCallback(
    (idx: number) => {
      if (idx >= boss.phases.length) {
        // Victory!
        setState({ kind: "victory", line: 0 });
        try {
          localStorage.setItem(trophyKey(boss.slug), JSON.stringify({ wonAt: Date.now() }));
        } catch {}
        return;
      }
      setPhaseIndex(idx);
      bullets.current = [];
      lastSpawn.current = 0;
      player.current = { x: BOX_W / 2, y: BOX_H / 2 };
      setState({ kind: "dodging", phase: idx, tStart: performance.now(), tauntIndex: 0 });
    },
    [boss],
  );

  const resetFight = useCallback(() => {
    setHp(boss.maxHp);
    setClock(boss.totalTimeSec);
    setPhaseIndex(0);
    totalElapsed.current = 0;
    bullets.current = [];
    setState({ kind: "intro", line: 0 });
  }, [boss]);

  const startPhaseRef = useRef(startPhase);
  const resetFightRef = useRef(resetFight);
  useEffect(() => {
    startPhaseRef.current = startPhase;
  }, [startPhase]);
  useEffect(() => {
    resetFightRef.current = resetFight;
  }, [resetFight]);

  // Keyboard
  useEffect(() => {
    function down(e: KeyboardEvent) {
      keys.current[e.key.toLowerCase()] = true;
      const cur = stateRef.current;
      if (cur.kind === "intro" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        if (cur.line + 1 < boss.intro.length) {
          setState({ kind: "intro", line: cur.line + 1 });
        } else {
          startPhaseRef.current(0);
        }
      } else if (cur.kind === "challenge" && (e.key === " " || e.key === "Enter")) {
        const phase = boss.phases[cur.phase];
        if (cur.line + 1 < phase.challenge.length) {
          setState({ kind: "challenge", phase: cur.phase, line: cur.line + 1 });
        } else {
          setState({
            kind: "solving",
            phase: cur.phase,
            integralIndex: Math.floor(Math.random() * phase.integrals.length),
            tStart: performance.now(),
            input: "",
            hintShown: false,
            wrong: false,
          });
        }
      } else if (cur.kind === "between" && (e.key === " " || e.key === "Enter")) {
        startPhaseRef.current(cur.phase + 1);
      } else if (cur.kind === "victory" && (e.key === " " || e.key === "Enter")) {
        if (cur.line + 1 < boss.victory.length) {
          setState({ kind: "victory", line: cur.line + 1 });
        }
      } else if (cur.kind === "defeat" && (e.key === " " || e.key === "Enter")) {
        if (cur.line + 1 < boss.defeat.length) {
          setState({ kind: "defeat", line: cur.line + 1 });
        } else {
          // restart
          resetFightRef.current();
        }
      }
    }
    function up(e: KeyboardEvent) {
      keys.current[e.key.toLowerCase()] = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [boss]);

  // Touch controls — drag player anywhere within the battle box
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function handle(e: TouchEvent) {
      if (stateRef.current.kind !== "dodging") return;
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const t = e.touches[0];
      if (!t) return;
      const x = ((t.clientX - rect.left) / rect.width) * BOX_W;
      const y = ((t.clientY - rect.top) / rect.height) * BOX_H;
      player.current.x = Math.max(PLAYER_R, Math.min(BOX_W - PLAYER_R, x));
      player.current.y = Math.max(PLAYER_R, Math.min(BOX_H - PLAYER_R, y));
    }
    function start(e: TouchEvent) {
      handle(e);
    }
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", handle, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", handle);
    };
  }, []);

  const spawnBullets = useCallback((phase: Phase, now: number, tInPhase: number) => {
    const interval = 1000 / phase.density;
    if (now - lastSpawn.current < interval) return;
    lastSpawn.current = now;
    const speed = phase.speed;
    switch (phase.pattern) {
      case "spiral": {
        // Spawn from a rotating point along the top edge so the centre stays survivable.
        const t = now / 1000;
        const angle = (t * 1.5) % (Math.PI * 2);
        const ox = BOX_W / 2 + Math.cos(t * 0.7) * (BOX_W * 0.35);
        const oy = -8;
        for (let i = 0; i < 3; i++) {
          const a = angle + (i * Math.PI * 2) / 3;
          // Bias downward so bullets clear the top edge.
          const vx = Math.cos(a) * speed;
          const vy = Math.abs(Math.sin(a)) * speed * 0.6 + speed * 0.6;
          bullets.current.push({
            x: ox,
            y: oy,
            vx,
            vy,
            r: 4,
            ttl: 4,
            kind: "round",
            born: now,
          });
        }
        break;
      }
      case "wave": {
        const fromLeft = Math.floor(now / 1500) % 2 === 0;
        const x = fromLeft ? -10 : BOX_W + 10;
        // Cover the full arena height by mapping sin into [PLAYER_R+4, BOX_H-PLAYER_R-4].
        const margin = PLAYER_R + 4;
        const range = BOX_H - margin * 2;
        const y = margin + ((Math.sin(now / 200) + 1) / 2) * range;
        bullets.current.push({
          x,
          y,
          vx: fromLeft ? speed : -speed,
          vy: 0,
          r: 4,
          ttl: 5,
          kind: "round",
          born: now,
        });
        break;
      }
      case "sweep": {
        // Vertical wall scrolling across, leaving a player-sized gap
        const gapY = (Math.sin(now / 800) * 0.45 + 0.5) * BOX_H;
        const fromLeft = Math.floor(tInPhase / 3) % 2 === 0;
        for (let y = 6; y < BOX_H; y += 16) {
          if (Math.abs(y - gapY) < 22) continue;
          bullets.current.push({
            x: fromLeft ? -10 : BOX_W + 10,
            y,
            vx: fromLeft ? speed : -speed,
            vy: 0,
            r: 4,
            ttl: 4,
            kind: "round",
            born: now,
          });
        }
        break;
      }
      case "rain": {
        const x = Math.random() * BOX_W;
        bullets.current.push({
          x,
          y: -10,
          vx: 0,
          vy: speed,
          r: 4,
          ttl: 4,
          kind: "round",
          born: now,
        });
        // occasional sideways bone
        if (Math.random() < 0.2) {
          bullets.current.push({
            x: -10,
            y: Math.random() * BOX_H,
            vx: speed * 0.9,
            vy: 0,
            r: 3,
            ttl: 4,
            kind: "bone",
            born: now,
          });
        }
        break;
      }
      case "blaster": {
        // Aimed bursts from a random edge
        const edge = Math.floor(Math.random() * 4);
        const target = { x: player.current.x, y: player.current.y };
        let sx = 0,
          sy = 0;
        if (edge === 0) {
          sx = Math.random() * BOX_W;
          sy = -10;
        } else if (edge === 1) {
          sx = BOX_W + 10;
          sy = Math.random() * BOX_H;
        } else if (edge === 2) {
          sx = Math.random() * BOX_W;
          sy = BOX_H + 10;
        } else {
          sx = -10;
          sy = Math.random() * BOX_H;
        }
        const dx = target.x - sx;
        const dy = target.y - sy;
        const len = Math.max(0.001, Math.hypot(dx, dy));
        bullets.current.push({
          x: sx,
          y: sy,
          vx: (dx / len) * speed,
          vy: (dy / len) * speed,
          r: 5,
          ttl: 4,
          kind: "laser",
          born: now,
        });
        break;
      }
      case "bones": {
        // Vertical bones falling from top OR bottom — never spawn on top of the player.
        const fromTop = Math.random() < 0.5;
        let x = Math.random() * BOX_W;
        if (Math.abs(x - player.current.x) < PLAYER_R * 4) {
          x = (x + BOX_W / 2) % BOX_W;
        }
        bullets.current.push({
          x,
          y: fromTop ? -10 : BOX_H + 10,
          vx: 0,
          vy: fromTop ? speed : -speed,
          r: 3,
          ttl: 4,
          kind: "bone",
          born: now,
        });
        break;
      }
    }
  }, []);

  // Game loop
  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    if (!canvas || !ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    function loop(now: number) {
      const dt = Math.min(0.05, lastFrame.current ? (now - lastFrame.current) / 1000 : 0);
      lastFrame.current = now;
      const cur = stateRef.current;

      // Total fight clock — only ticks once we're past the intro.
      if (cur.kind !== "intro" && cur.kind !== "victory" && cur.kind !== "defeat") {
        totalElapsed.current += dt;
        const remaining = Math.max(0, boss.totalTimeSec - totalElapsed.current);
        if (remaining !== clockRef.current) {
          setClock(Math.ceil(remaining));
        }
        if (remaining <= 0) {
          setState({ kind: "defeat", line: 0 });
        }
      }

      // Move player
      if (cur.kind === "dodging") {
        const dx =
          (keys.current["arrowright"] || keys.current["d"] ? 1 : 0) -
          (keys.current["arrowleft"] || keys.current["a"] ? 1 : 0);
        const dy =
          (keys.current["arrowdown"] || keys.current["s"] ? 1 : 0) -
          (keys.current["arrowup"] || keys.current["w"] ? 1 : 0);
        const len = Math.hypot(dx, dy) || 1;
        player.current.x += (dx / len) * PLAYER_SPEED * dt;
        player.current.y += (dy / len) * PLAYER_SPEED * dt;
        player.current.x = Math.max(PLAYER_R, Math.min(BOX_W - PLAYER_R, player.current.x));
        player.current.y = Math.max(PLAYER_R, Math.min(BOX_H - PLAYER_R, player.current.y));

        const phase = boss.phases[cur.phase];
        const tInPhase = (now - cur.tStart) / 1000;

        // Cycle taunts
        const tauntIdx = Math.min(phase.taunts.length - 1, Math.floor(tInPhase / 4));
        if (tauntIdx !== cur.tauntIndex) {
          setState({ kind: "dodging", phase: cur.phase, tStart: cur.tStart, tauntIndex: tauntIdx });
        }

        spawnBullets(phase, now, tInPhase);

        // Update bullets
        for (const b of bullets.current) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.ttl -= dt;
        }
        bullets.current = bullets.current.filter(
          (b) =>
            b.ttl > 0 && b.x > -30 && b.x < BOX_W + 30 && b.y > -30 && b.y < BOX_H + 30,
        );

        // Hit detection
        if (now > invulnUntil.current) {
          for (const b of bullets.current) {
            const dx2 = b.x - player.current.x;
            const dy2 = b.y - player.current.y;
            if (dx2 * dx2 + dy2 * dy2 < (b.r + PLAYER_R - 1) * (b.r + PLAYER_R - 1)) {
              const newHp = hpRef.current - 1;
              setHp(newHp);
              invulnUntil.current = now + 800;
              if (newHp <= 0) {
                setState({ kind: "defeat", line: 0 });
              }
              break;
            }
          }
        }

        // End of dodge phase?
        if (tInPhase >= phase.dodgeSeconds) {
          bullets.current = [];
          setState({ kind: "challenge", phase: cur.phase, line: 0 });
        }
      }

      // Render
      ctx.clearRect(0, 0, BOX_W, BOX_H);
      ctx.fillStyle = "rgba(8, 10, 18, 0.65)";
      ctx.fillRect(0, 0, BOX_W, BOX_H);
      ctx.strokeStyle = "#f05d9b";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, BOX_W - 2, BOX_H - 2);

      // grid hint
      ctx.strokeStyle = "rgba(125, 137, 164, 0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i < BOX_W; i += 26) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, BOX_H);
        ctx.stroke();
      }

      // bullets
      for (const b of bullets.current) {
        if (b.kind === "laser") {
          ctx.fillStyle = "#f05d9b";
          ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        } else if (b.kind === "bone") {
          ctx.fillStyle = "#e6ecff";
          ctx.fillRect(b.x - b.r, b.y - b.r * 1.6, b.r * 2, b.r * 3.2);
        } else {
          ctx.fillStyle = "#f6c177";
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // player heart
      const flicker = now < invulnUntil.current && Math.floor(now / 80) % 2 === 0;
      if (!flicker) {
        ctx.fillStyle = "#f05d9b";
        const px = player.current.x;
        const py = player.current.y;
        const s = PLAYER_R;
        ctx.beginPath();
        ctx.moveTo(px, py + s * 0.9);
        ctx.bezierCurveTo(px - s * 1.6, py - s * 0.2, px - s * 0.6, py - s * 1.2, px, py - s * 0.3);
        ctx.bezierCurveTo(px + s * 0.6, py - s * 1.2, px + s * 1.6, py - s * 0.2, px, py + s * 0.9);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss]);

  const [solveRemaining, setSolveRemaining] = useState(0);

  // Solving timer
  useEffect(() => {
    if (state.kind !== "solving") return;
    const phase = boss.phases[state.phase];
    const integral = phase.integrals[state.integralIndex];
    const limit = integral.solveSeconds * 1000;
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSolveRemaining(limit);
    const id = window.setInterval(() => {
      const elapsed = performance.now() - state.tStart;
      const remaining = Math.max(0, limit - elapsed);
      setSolveRemaining(remaining);
      const cur = stateRef.current;
      if (cur.kind === "solving" && remaining <= 5000 && !cur.hintShown) {
        setState({ ...cur, hintShown: true });
      }
      if (remaining <= 0 && cur.kind === "solving") {
        setState({ kind: "defeat", line: 0 });
      }
    }, 100);
    return () => clearInterval(id);
  }, [state, boss]);

  const integralLatex = useMemo(() => {
    if (state.kind !== "solving") return "";
    const phase = boss.phases[state.phase];
    const integral = phase.integrals[state.integralIndex];
    return katex.renderToString(integral.prompt, {
      throwOnError: false,
      displayMode: true,
    });
  }, [state, boss]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "solving") return;
    const phase = boss.phases[state.phase];
    const integral = phase.integrals[state.integralIndex];
    if (isCorrect(state.input, integral.answers)) {
      if (state.phase + 1 >= boss.phases.length) {
        setState({ kind: "victory", line: 0 });
        try {
          localStorage.setItem(trophyKey(boss.slug), JSON.stringify({ wonAt: Date.now() }));
        } catch {}
      } else {
        setState({ kind: "between", phase: state.phase });
      }
    } else {
      setState({ ...state, wrong: true });
      setTimeout(() => {
        const cur = stateRef.current;
        if (cur.kind === "solving") setState({ ...cur, wrong: false });
      }, 700);
    }
  }

  const phase = boss.phases[Math.min(phaseIndex, boss.phases.length - 1)];
  const portrait = phase?.image ?? boss.portrait;

  let dialogue: string[] = [];
  let canAdvance = false;
  let lineIdx = 0;
  if (state.kind === "intro") {
    dialogue = boss.intro;
    lineIdx = state.line;
    canAdvance = true;
  } else if (state.kind === "dodging") {
    dialogue = phase.taunts;
    lineIdx = Math.min(phase.taunts.length - 1, state.tauntIndex);
  } else if (state.kind === "challenge") {
    dialogue = phase.challenge;
    lineIdx = state.line;
    canAdvance = true;
  } else if (state.kind === "between") {
    dialogue = ["* Phase complete. * * *", "* Press SPACE to continue."];
    canAdvance = true;
  } else if (state.kind === "victory") {
    dialogue = boss.victory;
    lineIdx = state.line;
    canAdvance = state.line + 1 < boss.victory.length;
  } else if (state.kind === "defeat") {
    dialogue = boss.defeat;
    lineIdx = state.line;
    canAdvance = true;
  }

  const dodging = state.kind === "dodging";
  const solving = state.kind === "solving";

  return (
    <div className="battle-shell" ref={wrapRef}>
      <header className="battle-header">
        <Link href="/playground" className="secondary-action compact">
          <ArrowLeft size={16} />
          Leave fight
        </Link>
        <div className="battle-header-stats">
          <span className="battle-clock" data-low={clock <= 20}>
            ⏱ {Math.floor(clock / 60)}:{String(clock % 60).padStart(2, "0")}
          </span>
          <span className="battle-hp" aria-label={`HP ${hp} of ${boss.maxHp}`}>
            {Array.from({ length: boss.maxHp }).map((_, i) => (
              <Heart
                key={i}
                size={16}
                fill={i < hp ? "#f05d9b" : "transparent"}
                color={i < hp ? "#f05d9b" : "rgba(125,137,164,0.4)"}
              />
            ))}
          </span>
          <span className="battle-phase-pill">
            Phase {Math.min(phaseIndex + 1, boss.phases.length)} / {boss.phases.length}
          </span>
        </div>
      </header>

      <div className="battle-stage">
        <div className="battle-portrait">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portrait} alt={boss.name} />
          <div className="battle-portrait-name">
            <p className="eyebrow">{boss.eyebrow}</p>
            <strong>{boss.name}</strong>
          </div>
        </div>

        <div className="battle-arena">
          <canvas
            ref={canvasRef}
            width={BOX_W}
            height={BOX_H}
            className="battle-canvas"
            aria-label={`${boss.name} battle arena`}
          />
          {!dodging && !solving ? (
            <div className="battle-canvas-overlay">
              {state.kind === "intro" || state.kind === "between" || state.kind === "challenge"
                ? "Press SPACE to continue"
                : state.kind === "victory"
                  ? "🏆 Trophy unlocked"
                  : state.kind === "defeat"
                    ? "Press SPACE to retry"
                    : ""}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`battle-dialogue${state.kind === "defeat" ? " is-defeat" : ""}${state.kind === "victory" ? " is-victory" : ""}`}>
        <div className="battle-dialogue-text">
          {dialogue.slice(0, lineIdx + 1).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        {canAdvance ? <small className="battle-dialogue-hint">SPACE / ENTER →</small> : null}
      </div>

      {solving ? (
        <form onSubmit={submit} className={`battle-solve${state.wrong ? " is-wrong" : ""}`}>
          <div
            className="battle-integral"
            dangerouslySetInnerHTML={{ __html: integralLatex }}
          />
          <div className="battle-solve-meta">
            <span>⏱ {(solveRemaining / 1000).toFixed(1)}s</span>
            {state.hintShown && phase.integrals[state.integralIndex].hint ? (
              <span className="battle-solve-hint">💡 {phase.integrals[state.integralIndex].hint}</span>
            ) : null}
          </div>
          <div className="battle-solve-input-row">
            <input
              ref={inputRef}
              value={state.input}
              onChange={(e) => setState({ ...state, input: e.target.value })}
              placeholder="Type the answer (e.g. pi/4 or 0.7853)"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="submit" className="primary-action">
              Submit
            </button>
          </div>
          {state.wrong ? <small className="battle-solve-wrong">* WRONG. Try again.</small> : null}
        </form>
      ) : null}

      {state.kind === "victory" ? (
        <div className="battle-trophy">
          <Trophy size={28} />
          <div>
            <strong>{boss.trophyTitle}</strong>
            <p>{boss.trophyFlavor}</p>
          </div>
          <Link href="/playground" className="secondary-action compact">
            Back to Playground
          </Link>
        </div>
      ) : null}

      {state.kind === "defeat" ? (
        <div className="battle-defeat">
          <button type="button" className="primary-action" onClick={resetFight}>
            Try again
          </button>
          <Link href="/playground" className="secondary-action compact">
            Leave
          </Link>
        </div>
      ) : null}
    </div>
  );
}
