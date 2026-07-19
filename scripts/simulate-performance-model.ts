import { computePerformanceProfile } from "../lib/analytics";

const STUDENT_COUNT = 100;
const SET_COUNT = 100;

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function normalNoise(random: () => number) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rank(values: number[]) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array<number>(values.length);
  for (let start = 0; start < sorted.length; ) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1].value === sorted[start].value) end++;
    const averageRank = (start + end + 2) / 2;
    for (let index = start; index <= end; index++) ranks[sorted[index].index] = averageRank;
    start = end + 1;
  }
  return ranks;
}

function correlation(left: number[], right: number[]) {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index++) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  return covariance / Math.sqrt(leftVariance * rightVariance);
}

const random = createRandom(67_100);
const sets = Array.from({ length: SET_COUNT }, (_, index) => ({
  id: `set-${index + 1}`,
  difficulty: 25 + (index / (SET_COUNT - 1)) * 55,
  maxScore: 10 + (index % 6) * 10,
}));

const students = Array.from({ length: STUDENT_COUNT }, (_, index) => {
  const ability = 25 + (index / (STUDENT_COUNT - 1)) * 65;
  const participationTarget = clamp(
    Math.round(8 + (index / (STUDENT_COUNT - 1)) * 82 + normalNoise(random) * 8),
    3,
    SET_COUNT,
  );
  const selectedSets = [...sets].sort(() => random() - 0.5).slice(0, participationTarget);
  const attempts: Array<{ problemSetId: string; score: number; maxScore: number }> = [];

  for (const set of selectedSets) {
    const percent = clamp(55 + ability - set.difficulty + normalNoise(random) * 9, 0, 100);
    attempts.push({
      problemSetId: set.id,
      score: Math.round((percent / 100) * set.maxScore),
      maxScore: set.maxScore,
    });
    if (random() < 0.22) {
      const retryPercent = clamp(percent + 4 + normalNoise(random) * 5, 0, 100);
      attempts.push({
        problemSetId: set.id,
        score: Math.round((retryPercent / 100) * set.maxScore),
        maxScore: set.maxScore,
      });
    }
  }

  return {
    id: `student-${index + 1}`,
    ability,
    profile: computePerformanceProfile(attempts, SET_COUNT),
  };
});

const abilityRanks = rank(students.map((student) => student.ability));
const indexRanks = rank(students.map((student) => student.profile.masteryIndex));
const spearman = correlation(abilityRanks, indexRanks);
const uniqueIndices = new Set(students.map((student) => student.profile.masteryIndex)).size;
const onePerfect = computePerformanceProfile(
  [{ problemSetId: "single", score: 10, maxScore: 10 }],
  SET_COUNT,
);
const broadStrong = computePerformanceProfile(
  Array.from({ length: 60 }, (_, index) => ({
    problemSetId: `broad-${index}`,
    score: 8,
    maxScore: 10,
  })),
  SET_COUNT,
);

const deciles = Array.from({ length: 10 }, (_, decile) => {
  const slice = students.slice(decile * 10, decile * 10 + 10);
  return (
    slice.reduce((sum, student) => sum + student.profile.masteryIndex, 0) / slice.length
  ).toFixed(1);
});

console.log(`Dataset: ${STUDENT_COUNT} students x ${SET_COUNT} problem sets`);
console.log(`Spearman ability/index correlation: ${spearman.toFixed(3)}`);
console.log(`Distinct Mastery Index values: ${uniqueIndices}/${STUDENT_COUNT}`);
console.log(`Ability-decile mean indices: ${deciles.join(" -> ")}`);
console.log(
  `One perfect set: ${onePerfect.masteryIndex.toFixed(1)} (${onePerfect.evidence}); ` +
    `60 steady 80% sets: ${broadStrong.masteryIndex.toFixed(1)} (${broadStrong.evidence})`,
);

if (spearman < 0.85)
  throw new Error("Mastery Index does not track simulated ability closely enough.");
if (uniqueIndices < 80)
  throw new Error("Mastery Index does not separate the simulated cohort enough.");
if (broadStrong.masteryIndex <= onePerfect.masteryIndex) {
  throw new Error("Broad evidence should outrank one perfect set.");
}
