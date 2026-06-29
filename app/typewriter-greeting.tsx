"use client";

import { animate } from "animejs";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const DEFAULT_TYPE_SPEED_MS = 42;
const DEFAULT_DELETE_SPEED_MS = 22;
const DEFAULT_HOLD_MS = 3676;
const DEFAULT_BETWEEN_GREETING_MS = 280;
const DEFAULT_SPEEDS = {
  typeSpeed: DEFAULT_TYPE_SPEED_MS,
  deleteSpeed: DEFAULT_DELETE_SPEED_MS,
  holdMs: DEFAULT_HOLD_MS,
  betweenMs: DEFAULT_BETWEEN_GREETING_MS,
};

const GREETINGS = [
  (name: string) => `Hello, ${name}!`,
  (name: string) => `${name}, your working is correct but the answer is wrong.`,
  (name: string) => `Eat more curry, ${name}!`,
  (name: string) => `Subscribe to Let's Think Critically, ${name}!`,
  (name: string) => `${name}, have you tried turning your brain off and on again?`,
  (name: string) => `Welcome back, ${name}.`,
  (name: string) => `Wassup :), ${name}.`,
  (name: string) => `Be Culver Kwan, ${name}.`,
  (name: string) => `Time to lock in, ${name}.`,
  (name: string) => `Marcoroni is typing..., ${name}.`,
  (name: string) => `Search Marco The Dog, ${name}.`,
  (name: string) => `Be more ORZ, ${name}.`,
  (name: string) => `Solve these problems if you're not gay, ${name}.`,
  (name: string) => `${name}! Stay determined!`,
  (name: string) => `${name}, you forgot a ± somewhere.`,
  (name: string) => `${name}, you look like a trapezium.`,
  () => `Just cancel the dx's. Trust me.`,
  () => `Proof left as an exercise to the reader.`,
  () => `Step 1: Draw a circle. Step 2: ???. Step 3: Proof complete.`,
  () => `The Riemann Hypothesis has been solved!`,
  () => `I still remember the thrill of solving my first integral.`,
  (name: string) => `${name} divided by 0. Error.`,
  () => `Numbers don't lie.`,
  () => `Is it always true? Sometimes true? Or never true?`,
  (name: string) => `${name}, WAKE UP!`,
  () => `sin(x) = x. QED.`,
  () => `It is trivially obvious that 0 = 1. QED.`,
  (name: string) => `${name}" or 1 = 1 --`,
  () => `Take pi = 3`,
  () => `Eat. Sleep. Math. Repeat.`,
  (name: string) => `Initialising ${name}... please wait... still waiting...stillllllll waiting...`,
];

const INITIAL_GREETING_INDEX = 0;

const getRandomGreetingIndex = (exclude?: number) => {
  if (GREETINGS.length <= 1) return 0;
  let next = Math.floor(Math.random() * GREETINGS.length);
  if (exclude === undefined) return next;
  while (next === exclude) {
    next = Math.floor(Math.random() * GREETINGS.length);
  }
  return next;
};

function parseStoredSpeeds(raw: string | null) {
  if (!raw) {
    return DEFAULT_SPEEDS;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      typeSpeed: Math.max(10, Math.min(500, Number(parsed.typeSpeed) || DEFAULT_TYPE_SPEED_MS)),
      deleteSpeed: Math.max(
        10,
        Math.min(500, Number(parsed.deleteSpeed) || DEFAULT_DELETE_SPEED_MS),
      ),
      holdMs: Math.max(500, Math.min(15000, Number(parsed.holdMs) || DEFAULT_HOLD_MS)),
      betweenMs: Math.max(
        100,
        Math.min(5000, Number(parsed.betweenMs) || DEFAULT_BETWEEN_GREETING_MS),
      ),
    };
  } catch {
    return DEFAULT_SPEEDS;
  }
}

function getTypewriterSpeedsSnapshot() {
  return window.localStorage.getItem("mo-typewriter-settings") ?? "";
}

function getTypewriterSpeedsServerSnapshot() {
  return "";
}

function subscribeToTypewriterSpeeds(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function GreetingTyper({ name }: { name: string }) {
  const [greetingIndex, setGreetingIndex] = useState(INITIAL_GREETING_INDEX);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const storedSpeeds = useSyncExternalStore(
    subscribeToTypewriterSpeeds,
    getTypewriterSpeedsSnapshot,
    getTypewriterSpeedsServerSnapshot,
  );
  const speeds = useMemo(() => parseStoredSpeeds(storedSpeeds), [storedSpeeds]);

  const activeGreeting = useMemo(() => GREETINGS[greetingIndex](name), [greetingIndex, name]);

  useEffect(() => {
    let delay = isDeleting ? speeds.deleteSpeed : speeds.typeSpeed;

    if (!isDeleting && charIndex === activeGreeting.length) {
      delay = speeds.holdMs;
    }

    if (isDeleting && charIndex === 0) {
      delay = speeds.betweenMs;
    }

    const timer = window.setTimeout(() => {
      if (!isDeleting && charIndex < activeGreeting.length) {
        setCharIndex((current) => Math.min(current + 1, activeGreeting.length));
        return;
      }

      if (!isDeleting) {
        setIsDeleting(true);
        return;
      }

      if (charIndex > 0) {
        setCharIndex((current) => Math.max(current - 1, 0));
        return;
      }

      setIsDeleting(false);
      setGreetingIndex((current) => getRandomGreetingIndex(current));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    activeGreeting.length,
    charIndex,
    isDeleting,
    speeds.betweenMs,
    speeds.deleteSpeed,
    speeds.holdMs,
    speeds.typeSpeed,
  ]);

  useEffect(() => {
    const text = textRef.current;

    if (!text || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const textAnimation = animate(text, {
      opacity: [0.72, 1],
      translateY: [2, 0],
      duration: isDeleting ? 90 : 140,
      ease: "outQuad",
    });

    return () => {
      textAnimation.revert();
    };
  }, [charIndex, isDeleting]);

  useEffect(() => {
    const cursor = cursorRef.current;

    if (!cursor || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const cursorAnimation = animate(cursor, {
      opacity: [1, 0.16],
      scaleY: [1, 0.72],
      duration: 620,
      ease: "steps(2)",
      loop: true,
      alternate: true,
    });

    return () => {
      cursorAnimation.revert();
    };
  }, []);

  return (
    <span className="typewriter-greeting" aria-label={activeGreeting}>
      <span ref={textRef}>{activeGreeting.slice(0, charIndex)}</span>
      <span
        className={`typewriter-cursor${charIndex < activeGreeting.length || isDeleting ? " is-typing" : ""}`}
        ref={cursorRef}
        aria-hidden="true"
      >
        |
      </span>
    </span>
  );
}

export function TypewriterGreeting({ name }: { name: string }) {
  const normalizedName = name.trim() || "there";
  return <GreetingTyper key={normalizedName} name={normalizedName} />;
}
