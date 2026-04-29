"use client";

import { useEffect, useMemo, useState } from "react";

const TYPE_SPEED_MS = 42;
const DELETE_SPEED_MS = 22;
const HOLD_MS = 3676;
const BETWEEN_GREETING_MS = 280;

const GREETINGS = [
  (name: string) => `Hello, ${name}!`,
  (name: string) => `Ready for another set, ${name}?`,
  (name: string) => `Get on, ${name}.`,
  (name: string) => `Welcome back, ${name}.`,
  (name: string) => `Wassup, ${name}.`,
  (name: string) => `Good to see you, ${name}.`,
  (name: string) => `A little progress today, ${name}?`,
  (name: string) => `Make me proud, ${name}.`,
  (name: string) => `Your next solve is waiting, ${name}.`,
  (name: string) => `Time to lock in, ${name}.`,
];

function GreetingTyper({ name }: { name: string }) {
  const [greetingIndex, setGreetingIndex] = useState(0);
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
      setGreetingIndex((current) => (current + 1) % GREETINGS.length);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [activeGreeting.length, charIndex, isDeleting]);

  return (
    <span className="typewriter-greeting" aria-label={activeGreeting}>
      {activeGreeting.slice(0, charIndex)}
      <span className="typewriter-cursor" aria-hidden="true">
        |
      </span>
    </span>
  );
}

export function TypewriterGreeting({ name }: { name: string }) {
  const normalizedName = name.trim() || "there";
  return <GreetingTyper key={normalizedName} name={normalizedName} />;
}
