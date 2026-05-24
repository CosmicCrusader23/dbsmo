// Bosses live here. Add new fights by appending to BOSSES.
// Drop boss artwork in this same folder (lib/playground/) and import it below —
// Next.js will serve it via the static import. No public/ copy needed.

import type { StaticImageData } from "next/image";
import culverIcon from "./culvericon.jpg";
import culverPhase1 from "./culverphase1.jpg";
import culverPhase2 from "./culverphase2.jpg";
import marcoIcon from "./marcoicon.jpg";
import marcoPhase1 from "./marcophase1.jpg";

const src = (img: StaticImageData) => img.src;

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
  /** Pool of integrals for this phase. One is picked at random when the phase starts. */
  integrals: Integral[];
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
    "He grades on a strict gay curve. Survive his pen, then prove your integrals. " +
    "You will fail the first three times. Probably the next three too.",
  icon: src(culverIcon),
  portrait: src(culverPhase1),
  totalTimeSec: 240,
  maxHp: 3,
  difficulty: "sans-tier",
  intro: [
    "* Mr. Culver looks up from his marking pile.",
    "* \"Ah. Another candidate for my olympiad squad.\"",
    "* \"Show me you can move a pen.\"",
    "* \"Then show me you can move an island.\"",
  ],
  victory: [
    "* Mr. Culver caps his red pen.",
    "* \"...Acceptable.\"",
    "* \"You may sit in the front row.\"",
    "* TROPHY ACQUIRED — Culveroni.",
  ],
  defeat: [
    "* The bell rings.",
    "* Mr. Culver shakes his head.",
    "* \"See me after school in my home.\"",
    "* GAME OVER. Press space to retry.",
  ],
  phases: [
    {
      image: src(culverPhase1),
      dodgeSeconds: 12,
      taunts: [
        "* Don't tell me you forgot the chain rule.",
        "* I've seen Grade 1 students dodge faster.",
        "* This is the EASY one.",
      ],
      pattern: "wave",
      density: 4.2,
      speed: 230,
      challenge: [
        "* Mr. Culver writes on the board.",
        "* \"Evaluate. You have 25 seconds.\"",
      ],
      integrals: [
        {
          prompt: "\\int_0^{\\pi/2} \\sin^2 x\\, dx",
          answers: ["pi/4", "π/4", "(pi)/4", "0.7853981633974483", "0.7854"],
          hint: "Half-angle. sin²x = (1 − cos2x)/2.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_0^{\\pi/2} \\cos^2 x\\, dx",
          answers: ["pi/4", "π/4", "(pi)/4", "0.7853981633974483", "0.7854"],
          hint: "Half-angle. cos²x = (1 + cos2x)/2.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_0^{\\pi/4} \\sec^2 x\\, dx",
          answers: ["1", "1.0"],
          hint: "Antiderivative of sec²x is tan x.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_0^{\\pi/2} \\sin(2x)\\, dx",
          answers: ["1", "1.0"],
          hint: "u = 2x flips it into a clean cosine.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_0^{\\pi/3} \\sin x\\, dx",
          answers: ["1/2", "0.5"],
          hint: "1 − cos(π/3).",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_0^{\\pi} \\sin^2 x\\, dx",
          answers: ["pi/2", "π/2", "(pi)/2", "1.5707963267948966", "1.5708"],
          hint: "Same half-angle trick, longer interval.",
          solveSeconds: 25,
        },
      ],
    },
    {
      image: src(culverPhase1),
      dodgeSeconds: 14,
      taunts: [
        "* Pay attention. The hardest part is still ahead.",
        "* Grade 5s used to do this in their sleep.",
        "* You move like a piecewise function.",
      ],
      pattern: "spiral",
      density: 5.8,
      speed: 260,
      challenge: [
        "* Mr. Culver flips the page.",
        "* \"Integration by parts. Don't make me circle it.\"",
      ],
      integrals: [
        {
          prompt: "\\int_0^{1} x e^{x}\\, dx",
          answers: ["1", "1.0"],
          hint: "u = x, dv = eˣ dx. The boundary terms simplify.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_0^{1} x e^{-x}\\, dx",
          answers: ["1 - 2/e", "1-2/e", "(e-2)/e", "0.2642411176571153", "0.2642"],
          hint: "u = x, dv = e⁻ˣ dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_1^{e} \\ln x\\, dx",
          answers: ["1", "1.0"],
          hint: "u = ln x, dv = dx. Result is x ln x − x.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_0^{\\pi} x \\sin x\\, dx",
          answers: ["pi", "π", "3.141592653589793", "3.1416"],
          hint: "u = x, dv = sin x dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_0^{\\pi/2} x \\cos x\\, dx",
          answers: ["pi/2 - 1", "(pi-2)/2", "π/2 - 1", "0.5707963267948966", "0.5708"],
          hint: "u = x, dv = cos x dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_0^{1} x^{2} e^{x}\\, dx",
          answers: ["e - 2", "e-2", "0.7182818284590452", "0.7183"],
          hint: "Parts twice. Bring eˣ along.",
          solveSeconds: 22,
        },
      ],
    },
    {
      image: src(culverPhase2),
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
      integrals: [
        {
          prompt: "\\int_{0}^{1} \\frac{dx}{1+x^{2}}",
          answers: ["pi/4", "π/4", "(pi)/4", "arctan(1)", "tan^-1(1)", "0.7854"],
          hint: "It's a standard arctangent.",
          solveSeconds: 18,
        },
        {
          prompt: "\\int_{0}^{1} \\frac{dx}{\\sqrt{1-x^{2}}}",
          answers: ["pi/2", "π/2", "(pi)/2", "arcsin(1)", "1.5708"],
          hint: "Antiderivative is arcsin x.",
          solveSeconds: 18,
        },
        {
          prompt: "\\int_{1}^{\\sqrt{3}} \\frac{dx}{1+x^{2}}",
          answers: ["pi/12", "π/12", "(pi)/12", "0.2617993877991494", "0.2618"],
          hint: "arctan(√3) − arctan(1) = π/3 − π/4.",
          solveSeconds: 18,
        },
        {
          prompt: "\\int_{0}^{1/2} \\frac{dx}{\\sqrt{1-x^{2}}}",
          answers: ["pi/6", "π/6", "(pi)/6", "0.5235987755982988", "0.5236"],
          hint: "arcsin(1/2).",
          solveSeconds: 18,
        },
        {
          prompt: "\\int_{0}^{2} \\frac{dx}{4+x^{2}}",
          answers: ["pi/8", "π/8", "(pi)/8", "0.39269908169872414", "0.3927"],
          hint: "Standard form: 1/(a²+x²) → (1/a)arctan(x/a).",
          solveSeconds: 18,
        },
        {
          prompt: "\\int_{0}^{1} \\frac{x}{1+x^{2}}\\, dx",
          answers: ["ln(2)/2", "(ln2)/2", "ln(sqrt(2))", "0.34657359027997264", "0.3466"],
          hint: "u = 1+x². The numerator is half du.",
          solveSeconds: 18,
        },
      ],
    },
    {
      image: src(culverPhase2),
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
      integrals: [
        {
          prompt: "\\int_{0}^{\\pi/4} \\tan^{2} x\\, dx",
          answers: ["1 - pi/4", "1-pi/4", "1 − π/4", "(4-pi)/4", "0.2146018366025517", "0.2146"],
          hint: "tan²x = sec²x − 1.",
          solveSeconds: 20,
        },
        {
          prompt: "\\int_{0}^{1} \\frac{2x}{1+x^{2}}\\, dx",
          answers: ["ln(2)", "ln2", "0.6931471805599453", "0.6931"],
          hint: "u = 1+x². Numerator is exactly du.",
          solveSeconds: 20,
        },
        {
          prompt: "\\int_{0}^{1} x\\sqrt{1-x^{2}}\\, dx",
          answers: ["1/3", "0.3333333333333333", "0.3333"],
          hint: "u = 1−x², du = −2x dx.",
          solveSeconds: 20,
        },
        {
          prompt: "\\int_{1}^{e} \\frac{\\ln x}{x}\\, dx",
          answers: ["1/2", "0.5"],
          hint: "u = ln x.",
          solveSeconds: 20,
        },
        {
          prompt: "\\int_{0}^{\\pi/2} \\sin x \\cos x\\, dx",
          answers: ["1/2", "0.5"],
          hint: "u = sin x — or use the double angle.",
          solveSeconds: 20,
        },
        {
          prompt: "\\int_{0}^{1} \\frac{e^{x}}{1+e^{x}}\\, dx",
          answers: ["ln((1+e)/2)", "ln(1+e)-ln(2)", "0.6201557396773", "0.6202"],
          hint: "u = 1+eˣ.",
          solveSeconds: 20,
        },
        {
          prompt: "\\int_{0}^{\\pi/2} \\sin^{3} x\\, dx",
          answers: ["2/3", "0.6666666666666666", "0.6667"],
          hint: "Split off one sin x; rest in terms of cos x.",
          solveSeconds: 20,
        },
      ],
    },
    {
      image: src(culverPhase2),
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
      integrals: [
        {
          prompt: "\\int_{0}^{\\infty} e^{-x^{2}}\\, dx",
          answers: ["sqrt(pi)/2", "√π/2", "(sqrt(pi))/2", "(√π)/2", "0.886226925452758", "0.8862"],
          hint: "Square it, switch to polar coordinates.",
          solveSeconds: 30,
        },
        {
          prompt: "\\int_{0}^{\\infty} \\frac{dx}{1+x^{2}}",
          answers: ["pi/2", "π/2", "(pi)/2", "1.5707963267948966", "1.5708"],
          hint: "arctan from 0 to ∞.",
          solveSeconds: 30,
        },
        {
          prompt: "\\int_{0}^{\\infty} x e^{-x^{2}}\\, dx",
          answers: ["1/2", "0.5"],
          hint: "u = x². Closed form pops right out.",
          solveSeconds: 30,
        },
        {
          prompt: "\\int_{0}^{\\infty} x e^{-x}\\, dx",
          answers: ["1", "1.0"],
          hint: "Γ(2). Or parts.",
          solveSeconds: 30,
        },
        {
          prompt: "\\int_{0}^{\\infty} x^{2} e^{-x}\\, dx",
          answers: ["2", "2.0"],
          hint: "Γ(3) = 2! .",
          solveSeconds: 30,
        },
        {
          prompt: "\\int_{0}^{1} \\frac{\\ln(1+x)}{x}\\, dx",
          answers: ["pi^2/12", "(pi^2)/12", "π²/12", "0.8224670334241132", "0.8225"],
          hint: "Series: Σ (−1)ⁿ⁻¹ /n² from 1 to ∞.",
          solveSeconds: 30,
        },
        {
          prompt: "\\int_{-\\infty}^{\\infty} \\frac{dx}{1+x^{2}}",
          answers: ["pi", "π", "3.141592653589793", "3.1416"],
          hint: "Two-sided arctangent.",
          solveSeconds: 30,
        },
        {
          prompt: "\\int_{0}^{1} \\frac{\\ln x}{x-1}\\, dx",
          answers: ["pi^2/6", "(pi^2)/6", "π²/6", "1.6449340668482264", "1.6449"],
          hint: "Basel-flavoured. Σ 1/n².",
          solveSeconds: 30,
        },
      ],
    },
  ],
  trophyTitle: "Honour Roll · Integrals",
  trophyFlavor: "Survived Mr. Culver. Come to the staff room after school.",
};

const MARCO: Boss = {
  slug: "marco",
  name: "Marcoroni",
  eyebrow: "OI Captain · Grade 10 IB",
  description:
    "Current OI captain. Will respond to your DM in 4–6 business weeks. " +
    "Beat him at his own pace before he leaves you on read.",
  icon: src(marcoIcon),
  portrait: src(marcoPhase1),
  totalTimeSec: 180,
  maxHp: 4,
  difficulty: "warmup",
  intro: [
    "* You see Marco hunched over his laptop.",
    "* He has 14 unread messages from you.",
    "* \"oh hey. sorry just saw this.\"",
    "* \"warmup round. come at me.\"",
  ],
  victory: [
    "* Marco closes his laptop.",
    "* \"clean. ill add you to the squad gc.\"",
    "* (He won't.)",
    "* TROPHY ACQUIRED — Marcoroni.",
  ],
  defeat: [
    "* Marco is typing...",
    "* Marco is typing...",
    "* Marco has stopped typing.",
    "* GAME OVER. Press space to retry.",
  ],
  phases: [
    {
      image: src(marcoPhase1),
      dodgeSeconds: 14,
      taunts: [
        "* read 11:42pm. dodged.",
        "* my notifs are stacked rn.",
        "* its giving... competitive programming.",
        "* one sec, pulling up a problem.",
      ],
      pattern: "rain",
      density: 4.0,
      speed: 210,
      challenge: [
        "* Marco screen-shares a problem.",
        "* \"easy one. closed form. go.\"",
      ],
      integrals: [
        {
          prompt: "\\int_{0}^{2} x\\, dx",
          answers: ["2", "2.0"],
          hint: "Power rule. x²/2 evaluated at 2.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_{0}^{1} x^{2}\\, dx",
          answers: ["1/3", "0.3333333333333333", "0.3333"],
          hint: "Power rule.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_{0}^{\\pi} \\sin x\\, dx",
          answers: ["2", "2.0"],
          hint: "−cos π + cos 0.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_{0}^{1} e^{x}\\, dx",
          answers: ["e - 1", "e-1", "1.718281828459045", "1.7183"],
          hint: "Antiderivative is eˣ.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_{1}^{2} \\frac{1}{x}\\, dx",
          answers: ["ln(2)", "ln2", "0.6931471805599453", "0.6931"],
          hint: "ln of a ratio.",
          solveSeconds: 25,
        },
        {
          prompt: "\\int_{0}^{\\pi/2} \\cos x\\, dx",
          answers: ["1", "1.0"],
          hint: "sin(π/2) − sin 0.",
          solveSeconds: 25,
        },
      ],
    },
    {
      image: src(marcoPhase1),
      dodgeSeconds: 16,
      taunts: [
        "* alr im awake now.",
        "* you should pick up codeforces.",
        "* this one needs a sub.",
        "* tip: dont overthink the bounds.",
      ],
      pattern: "wave",
      density: 4.6,
      speed: 230,
      challenge: [
        "* Marco pastes a screenshot.",
        "* \"u-sub. 22 seconds.\"",
      ],
      integrals: [
        {
          prompt: "\\int_{0}^{1} 2x \\cdot e^{x^{2}}\\, dx",
          answers: ["e - 1", "e-1", "1.718281828459045", "1.7183"],
          hint: "u = x². du = 2x dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{0}^{1} \\frac{x}{1+x^{2}}\\, dx",
          answers: ["ln(2)/2", "(ln2)/2", "0.34657359027997264", "0.3466"],
          hint: "u = 1+x².",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{0}^{\\pi/2} \\sin x \\cos x\\, dx",
          answers: ["1/2", "0.5"],
          hint: "u = sin x.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{1}^{e} \\frac{\\ln x}{x}\\, dx",
          answers: ["1/2", "0.5"],
          hint: "u = ln x.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{0}^{1} x \\sqrt{1-x^{2}}\\, dx",
          answers: ["1/3", "0.3333333333333333", "0.3333"],
          hint: "u = 1−x², du = −2x dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{0}^{\\pi/4} \\tan x\\, dx",
          answers: ["ln(sqrt(2))", "(ln2)/2", "ln(2)/2", "0.34657359027997264", "0.3466"],
          hint: "Antiderivative is −ln|cos x|.",
          solveSeconds: 22,
        },
      ],
    },
    {
      image: src(marcoPhase1),
      dodgeSeconds: 18,
      taunts: [
        "* ok now im locked in.",
        "* this is what i actually do all day.",
        "* parts time. dont get cooked.",
        "* prediction: youll typo the answer.",
      ],
      pattern: "blaster",
      density: 5.4,
      speed: 250,
      challenge: [
        "* Marco grins.",
        "* \"final one. integration by parts. clock starts now.\"",
      ],
      integrals: [
        {
          prompt: "\\int_{0}^{1} x e^{x}\\, dx",
          answers: ["1", "1.0"],
          hint: "u = x, dv = eˣ dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{1}^{e} \\ln x\\, dx",
          answers: ["1", "1.0"],
          hint: "u = ln x, dv = dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{0}^{\\pi} x \\sin x\\, dx",
          answers: ["pi", "π", "3.141592653589793", "3.1416"],
          hint: "u = x, dv = sin x dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{0}^{\\pi/2} x \\cos x\\, dx",
          answers: ["pi/2 - 1", "(pi-2)/2", "π/2 - 1", "0.5707963267948966", "0.5708"],
          hint: "u = x, dv = cos x dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{0}^{1} x e^{-x}\\, dx",
          answers: ["1 - 2/e", "1-2/e", "(e-2)/e", "0.2642411176571153", "0.2642"],
          hint: "u = x, dv = e⁻ˣ dx.",
          solveSeconds: 22,
        },
        {
          prompt: "\\int_{0}^{1} x^{2} e^{x}\\, dx",
          answers: ["e - 2", "e-2", "0.7182818284590452", "0.7183"],
          hint: "Parts twice.",
          solveSeconds: 22,
        },
      ],
    },
  ],
  trophyTitle: "Read Receipt · Marcoroni",
  trophyFlavor: "Got a reply out of the OI captain. Don't expect a second one.",
};

export const BOSSES: Boss[] = [CULVER, MARCO];

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
