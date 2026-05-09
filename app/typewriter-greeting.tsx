"use client";

import { useEffect, useMemo, useState } from "react";

const TYPE_SPEED_MS = 42;
const DELETE_SPEED_MS = 22;
const HOLD_MS = 3676;
const BETWEEN_GREETING_MS = 280;

const GREETINGS = [
  (name: string) => `Hello, ${name}!`,
  (name: string) => `Eat more curry, ${name}!`,
  (name: string) => `Subscribe to Let's Think Critically, ${name}!`,
  (name: string) => `Welcome back, ${name}.`,
  (name: string) => `Wassup :), ${name}.`,
  (name: string) => `Good to see you, ${name}.`,
  (name: string) => `Make me proud, ${name}.`,
  (name: string) => `Be Culver Kwan, ${name}.`,
  (name: string) => `Time to lock in, ${name}.`,
  (name: string) => `Be Marcoroni :3, ${name}.`,
  (name: string) => `Marcoroni is typing..., ${name}.`,
  (name: string) => `Search Marco The Dog, ${name}.`,
  (name: string) => `Be more ORZ, ${name}.`,
  (name: string) => `Solve these problems if you're not gay, ${name}.`,
  (name: string) => `${name}! Stay determined!`,
  () => `Nature is written in mathematical language.`,
  () => `In mathematics, you don’t understand things. You just get used to them.`,
  (name: string) => `${name}, you forgot a ± somewhere.`,
  (name: string) => `${name}, you look like a trapezium.`,
  () => `The Riemann Hypothesis has been solved!`,
  () => `I still remember the thrill of solving my first integral.`,
  () => `Numbers don't lie.`,
  () => `Is it always true? Sometimes true? Or never true?`,
  (name: string) => `${name}, WAKE UP!`,
  () => `lim h->0 f(x+h) - f(x) / h`,
  (name: string) => `${name}" or 1 = 1 --`,
  () => `Take pi = 3`,
  () => `Eat. Sleep. Math. Repeat.`,
];

const getRandomGreetingIndex = (exclude?: number) => {
  if (GREETINGS.length <= 1) return 0;
  let next = Math.floor(Math.random() * GREETINGS.length);
  if (exclude === undefined) return next;
  while (next === exclude) {
    next = Math.floor(Math.random() * GREETINGS.length);
  }
  return next;
};

function GreetingTyper({ name }: { name: string }) {
  const [greetingIndex, setGreetingIndex] = useState(() => getRandomGreetingIndex());
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeGreeting = useMemo(() => GREETINGS[greetingIndex](name), [greetingIndex, name]);

  useEffect(() => {
    let delay = isDeleting ? DELETE_SPEED_MS : TYPE_SPEED_MS;

    if (!isDeleting && charIndex === activeGreeting.length) {
      delay = HOLD_MS;
    }

    if (isDeleting && charIndex === 0) {
      delay = BETWEEN_GREETING_MS;
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
  }, [activeGreeting.length, charIndex, isDeleting]);

  return (
    <span className="typewriter-greeting" aria-label={activeGreeting}>
      {activeGreeting.slice(0, charIndex)}
      <span
        className={`typewriter-cursor${charIndex < activeGreeting.length || isDeleting ? " is-typing" : ""}`}
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
