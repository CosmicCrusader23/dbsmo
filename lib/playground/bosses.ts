// Bosses live here. Add new fights by appending to BOSSES.
// Edit dialogue, integrals, phase tuning right in this file — no other code changes needed.

export type BulletPattern = "spiral" | "wave" | "sweep" | "rain" | "blaster" | "bones";

export interface Integral {
  /** LaTeX rendered inside KaTeX */
  prompt: string;
  /** Accepted answers — case-insensitive, whitespace-stripped match */
  answers: string[];
  /** Hint shown when 5 seconds remain */
  hint?: string;
  /** Seconds the player has to type the answer */
  solveSeconds: number;
}

export interface Phase {
  /** Image shown next to the dialogue box during this phase */
  image: string;
  /** Seconds of bullet hell before the integral appears */
  dodgeSeconds: number;
  /** Lines spoken while the player is dodging — cycle through these */
  taunts: string[];
  /** Pattern type — affects how projectiles spawn */
  pattern: BulletPattern;
  /** Bullets per second */
  density: number;
  /** Bullet speed (px / second) */
  speed: number;
  /** The integral the player must solve after surviving */
  integral: Integral;
  /** Lines spoken when the integral appears */
  challenge: string[];
}

export interface Boss {
  slug: string;
  name: string;
  /** Eyebrow tag above the name */
  eyebrow: string;
  /** Short description on the hub card */
  description: string;
  /** Square icon for the hub card (under /public) */
  icon: string;
  /** Larger portrait shown during the fight */
  portrait: string;
  /** Hard cap on the entire fight — TIME WILL TICK */
  totalTimeSec: number;
  /** Hits the player can take before they DIE */
  maxHp: number;
  /** Difficulty chip on the hub card */
  difficulty: "warmup" | "hard" | "sans-tier";
  /** Lines spoken before the fight begins */
  intro: string[];
  /** Lines spoken on victory */
  victory: string[];
  /** Lines spoken when the player runs out of time or HP */
  defeat: string[];
  /** Phases run in order. Each phase: dodge → integral → next */
  phases: Phase[];
  /** Trophy text shown on the hub card after victory */
  trophyTitle: string;
  trophyFlavor: string;
}

const CULVER: Boss = {
  slug: "culver",
  name: "Mr. Culver",
  eyebrow: "Faculty boss · DBSMO",
  description:
    "He grades on a strict curve. Survive his pen, then prove your integrals. " +
    "You will fail the first three times. Probably the next three too.",
  icon: "/playground/culvericon.jpg",
  portrait: "/playground/culverphase1.jpg",
  totalTimeSec: 120,
  maxHp: 3,
  difficulty: "sans-tier",
  intro: [
    "* Mr. Culver looks up from his marking pile.",
    "* \"Ah. Another candidate for the olympiad squad.\"",
    "* \"Show me you can move a pen.\"",
    "* \"Then show me you can move a symbol.\"",
  ],
  victory: [
    "* Mr. Culver caps his red pen.",
    "* \"...Acceptable.\"",
    "* \"You may sit in the front row.\"",
    "* TROPHY ACQUIRED — Honour Roll, Real Analysis.",
  ],
  defeat: [
    "* The bell rings.",
    "* Mr. Culver shakes his head.",
    "* \"See me after class.\"",
    "* GAME OVER. Press space to retry.",
  ],
  phases: [
    {
      image: "/playground/culverphase1.jpg",
      dodgeSeconds: 12,
      taunts: [
        "* Don't tell me you forgot the chain rule.",
        "* I've seen Form 1 students dodge faster.",
        "* This is the EASY one.",
      ],
      pattern: "wave",
      density: 4.2,
      speed: 230,
      challenge: [
        "* Mr. Culver writes on the board.",
        "* \"Evaluate. You have 25 seconds.\"",
      ],
      integral: {
        prompt: "\\int_0^{\\pi/2} \\sin^2 x\\, dx",
        answers: ["pi/4", "π/4", "(pi)/4", "0.7853981633974483"],
        hint: "Half-angle. sin²x = (1 − cos2x)/2.",
        solveSeconds: 25,
      },
    },
    {
      image: "/playground/culverphase1.jpg",
      dodgeSeconds: 14,
      taunts: [
        "* Pay attention. The hardest part is still ahead.",
        "* Form 5 used to do this in their sleep.",
        "* You move like a piecewise function.",
      ],
      pattern: "spiral",
      density: 5.8,
      speed: 260,
      challenge: [
        "* Mr. Culver flips the page.",
        "* \"Integration by parts. Don't make me circle it.\"",
      ],
      integral: {
        prompt: "\\int_0^{1} x e^{x}\\, dx",
        answers: ["1", "1.0"],
        hint: "u = x, dv = eˣ dx. The boundary terms simplify.",
        solveSeconds: 22,
      },
    },
    {
      image: "/playground/culverphase2.jpg",
      dodgeSeconds: 16,
      taunts: [
        "* I am not warmed up yet.",
        "* * * The chalk dust descends. * * *",
        "* You should have studied harder.",
      ],
      pattern: "sweep",
      density: 7.5,
      speed: 290,
      challenge: [
        "* The classroom dims.",
        "* \"This one was on the 1989 entrance paper.\"",
      ],
      integral: {
        prompt: "\\int_{0}^{1} \\frac{dx}{1+x^{2}}",
        answers: ["pi/4", "π/4", "(pi)/4", "arctan(1)", "tan^-1(1)"],
        hint: "It's a standard arctangent.",
        solveSeconds: 18,
      },
    },
    {
      image: "/playground/culverphase2.jpg",
      dodgeSeconds: 14,
      taunts: [
        "* Symbol manipulation is just typing with extra steps.",
        "* You can dodge. Can you SEE?",
        "* I taught your father this exact problem.",
      ],
      pattern: "rain",
      density: 9,
      speed: 320,
      challenge: [
        "* Mr. Culver does NOT smile.",
        "* \"Substitution. Twenty seconds. Go.\"",
      ],
      integral: {
        prompt: "\\int_{0}^{\\pi/4} \\tan^{2} x\\, dx",
        answers: ["1 - pi/4", "1-pi/4", "1 − π/4", "(4-pi)/4", "0.2146018366025517"],
        hint: "tan²x = sec²x − 1.",
        solveSeconds: 20,
      },
    },
    {
      image: "/playground/culverphase2.jpg",
      dodgeSeconds: 18,
      taunts: [
        "* Final question.",
        "* Last bell.",
        "* I have given you everything you need.",
        "* * * The room is very quiet now. * * *",
      ],
      pattern: "blaster",
      density: 6,
      speed: 360,
      challenge: [
        "* Mr. Culver writes one more line on the board.",
        "* \"Definite. Closed form. Prove it.\"",
      ],
      integral: {
        prompt: "\\int_{0}^{\\infty} e^{-x^{2}}\\, dx",
        answers: ["sqrt(pi)/2", "√π/2", "(sqrt(pi))/2", "(√π)/2", "0.886226925452758"],
        hint: "Square it, switch to polar coordinates.",
        solveSeconds: 30,
      },
    },
  ],
  trophyTitle: "Honour Roll · Real Analysis",
  trophyFlavor: "Survived Mr. Culver. Bring proof to the staff room.",
};

export const BOSSES: Boss[] = [CULVER];

export function getBoss(slug: string): Boss | null {
  return BOSSES.find((b) => b.slug === slug) ?? null;
}

export function normalizeAnswer(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/\\,/g, "")
    .replace(/\^{?1}?/g, "")
    .replace(/[{}]/g, "")
    .toLowerCase();
}

export function isCorrect(input: string, accepted: string[]): boolean {
  const norm = normalizeAnswer(input);
  return accepted.some((ans) => normalizeAnswer(ans) === norm);
}
