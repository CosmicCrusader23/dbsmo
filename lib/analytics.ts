import { normalizeTagList } from "./problem-tags";

export type TopicAccuracy = {
  topic: string;
  total: number;
  correct: number;
  accuracy: number;
};

export type ScoreBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
};

export type QuestionStat = {
  problemSetTitle: string;
  problemSetSlug: string;
  problemNumber: number;
  total: number;
  correct: number;
  accuracy: number;
};

export type PerformanceEvidence = "none" | "limited" | "developing" | "established";

export type PerformanceProfile = {
  masteryIndex: number;
  bestSetAverage: number;
  proficiency: number;
  breadth: number;
  consistency: number;
  masteryRate: number;
  attemptedSets: number;
  masteredSets: number;
  totalAttempts: number;
  evidence: PerformanceEvidence;
};

export function performanceEvidenceLabel(evidence: PerformanceEvidence) {
  switch (evidence) {
    case "limited":
      return "Limited";
    case "developing":
      return "Developing";
    case "established":
      return "Established";
    default:
      return "No evidence";
  }
}

type PerformanceAttempt = {
  score: number;
  maxScore: number;
  problemSetId: string;
};

const PERFORMANCE_PRIOR_SCORE = 50;
const PERFORMANCE_PRIOR_SETS = 3;
const MASTERY_THRESHOLD = 80;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(sortedValues: number[], quantile: number) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function evidenceForSetCount(attemptedSets: number): PerformanceEvidence {
  if (attemptedSets === 0) return "none";
  if (attemptedSets < 5) return "limited";
  if (attemptedSets < 15) return "developing";
  return "established";
}

export function computeTopicAccuracy(
  responses: Array<{ isCorrect: boolean; problem: { topicTags: string[] } }>,
): TopicAccuracy[] {
  const map = new Map<string, { total: number; correct: number }>();

  for (const r of responses) {
    const tags = normalizeTagList(r.problem.topicTags);
    for (const tag of tags) {
      const entry = map.get(tag) ?? { total: 0, correct: 0 };
      entry.total++;
      if (r.isCorrect) entry.correct++;
      map.set(tag, entry);
    }
  }

  return Array.from(map.entries())
    .map(([topic, { total, correct }]) => ({
      topic,
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export function computeScoreBuckets(
  attempts: Array<{ score: number; maxScore: number }>,
): ScoreBucket[] {
  const buckets: ScoreBucket[] = [
    { label: "0–20%", min: 0, max: 20, count: 0 },
    { label: "21–40%", min: 21, max: 40, count: 0 },
    { label: "41–60%", min: 41, max: 60, count: 0 },
    { label: "61–80%", min: 61, max: 80, count: 0 },
    { label: "81–100%", min: 81, max: 100, count: 0 },
  ];

  for (const a of attempts) {
    const pct = a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0;
    const bucket = buckets.find((b) => pct >= b.min && pct <= b.max);
    if (bucket) bucket.count++;
  }

  return buckets;
}

export function computeQuestionStats(
  responses: Array<{
    isCorrect: boolean;
    problem: { number: number; problemSetId: string };
  }>,
  setMap: Map<string, { title: string; slug: string }>,
): QuestionStat[] {
  const map = new Map<string, QuestionStat>();

  for (const r of responses) {
    const key = `${r.problem.problemSetId}:${r.problem.number}`;
    const setInfo = setMap.get(r.problem.problemSetId);
    const entry = map.get(key) ?? {
      problemSetTitle: setInfo?.title ?? "",
      problemSetSlug: setInfo?.slug ?? "",
      problemNumber: r.problem.number,
      total: 0,
      correct: 0,
      accuracy: 0,
    };
    entry.total++;
    if (r.isCorrect) entry.correct++;
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((q) => ({
      ...q,
      accuracy: q.total > 0 ? Math.round((q.correct / q.total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export function accuracyLevel(accuracy: number): "success" | "warning" | "danger" {
  if (accuracy >= 70) return "success";
  if (accuracy >= 40) return "warning";
  return "danger";
}

export function escapeCsvField(value: string): string {
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  if (
    safeValue.includes(",") ||
    safeValue.includes('"') ||
    safeValue.includes("\r") ||
    safeValue.includes("\n")
  ) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

export function computePerformanceProfile(
  attempts: PerformanceAttempt[],
  totalAvailableSets: number,
): PerformanceProfile {
  const bestPerSet = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.maxScore <= 0 || !Number.isFinite(attempt.score)) continue;
    const percent = clampPercent((attempt.score / attempt.maxScore) * 100);
    bestPerSet.set(
      attempt.problemSetId,
      Math.max(bestPerSet.get(attempt.problemSetId) ?? 0, percent),
    );
  }

  const bestScores = Array.from(bestPerSet.values()).sort((a, b) => a - b);
  const attemptedSets = bestScores.length;
  if (attemptedSets === 0) {
    return {
      masteryIndex: 0,
      bestSetAverage: 0,
      proficiency: 0,
      breadth: 0,
      consistency: 0,
      masteryRate: 0,
      attemptedSets: 0,
      masteredSets: 0,
      totalAttempts: attempts.length,
      evidence: "none",
    };
  }

  const bestSetAverage = mean(bestScores);
  const proficiency =
    (bestScores.reduce((sum, score) => sum + score, 0) +
      PERFORMANCE_PRIOR_SCORE * PERFORMANCE_PRIOR_SETS) /
    (attemptedSets + PERFORMANCE_PRIOR_SETS);
  const lowerQuartile = percentile(bestScores, 0.25);
  const consistency =
    (lowerQuartile * attemptedSets + PERFORMANCE_PRIOR_SCORE * PERFORMANCE_PRIOR_SETS) /
    (attemptedSets + PERFORMANCE_PRIOR_SETS);
  const coverageDenominator = Math.max(attemptedSets, Math.max(0, totalAvailableSets));
  const breadth = Math.sqrt(attemptedSets / coverageDenominator) * 100;
  const masteredSets = bestScores.filter((score) => score >= MASTERY_THRESHOLD).length;
  const masteryRate = (masteredSets / attemptedSets) * 100;
  const masteryIndex = proficiency * 0.65 + breadth * 0.2 + consistency * 0.15;

  return {
    masteryIndex: roundOne(masteryIndex),
    bestSetAverage: roundOne(bestSetAverage),
    proficiency: roundOne(proficiency),
    breadth: roundOne(breadth),
    consistency: roundOne(consistency),
    masteryRate: roundOne(masteryRate),
    attemptedSets,
    masteredSets,
    totalAttempts: attempts.length,
    evidence: evidenceForSetCount(attemptedSets),
  };
}
