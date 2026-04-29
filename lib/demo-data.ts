export type StudentSetStatus = "Solved" | "Attempted" | "Not started" | "Review";

export type ProblemSetSummary = {
  slug: string;
  title: string;
  topics: string[];
  difficulty: number;
  status: StudentSetStatus;
  bestScore: number;
  latestScore: number | null;
  attempts: number;
  updatedAt: string;
};

export const problemSets: ProblemSetSummary[] = [
  {
    slug: "mo-set-001",
    title: "Algebra Basics",
    topics: ["Algebra", "Equations"],
    difficulty: 2,
    status: "Solved",
    bestScore: 88,
    latestScore: 82,
    attempts: 2,
    updatedAt: "2026-04-20",
  },
  {
    slug: "mo-set-002",
    title: "Number Theory Sprint",
    topics: ["Number Theory"],
    difficulty: 3,
    status: "Attempted",
    bestScore: 61,
    latestScore: 61,
    attempts: 1,
    updatedAt: "2026-04-24",
  },
  {
    slug: "mo-set-003",
    title: "Combinatorics Warmup",
    topics: ["Combinatorics"],
    difficulty: 2,
    status: "Not started",
    bestScore: 0,
    latestScore: null,
    attempts: 0,
    updatedAt: "-",
  },
  {
    slug: "mo-set-004",
    title: "Geometry Angles",
    topics: ["Geometry"],
    difficulty: 4,
    status: "Review",
    bestScore: 49,
    latestScore: 44,
    attempts: 3,
    updatedAt: "2026-04-27",
  },
];

export const topicScores = [
  { topic: "Algebra", score: 84, color: "cyan" },
  { topic: "Number Theory", score: 61, color: "purple" },
  { topic: "Combinatorics", score: 0, color: "pink" },
  { topic: "Geometry", score: 49, color: "orange" },
];

export const adminRows = [
  { name: "A. Chan", completed: 23, average: 77, weakTopic: "Geometry", lastSeen: "Today" },
  { name: "B. Lee", completed: 14, average: 63, weakTopic: "Number Theory", lastSeen: "Yesterday" },
  { name: "C. Wong", completed: 31, average: 81, weakTopic: "Combinatorics", lastSeen: "Today" },
  { name: "D. Ho", completed: 9, average: 55, weakTopic: "Algebra", lastSeen: "3 days ago" },
];
