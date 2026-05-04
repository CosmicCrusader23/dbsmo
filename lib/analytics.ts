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
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (safeValue.includes(",") || safeValue.includes('"') || safeValue.includes("\n")) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

export function computeBestAverageScore(
  attempts: Array<{ score: number; maxScore: number; problemSetId: string }>,
): number {
  if (attempts.length === 0) return 0;

  const bestPerSet = new Map<string, number>();
  for (const a of attempts) {
    if (a.maxScore > 0) {
      const pct = (a.score / a.maxScore) * 100;
      bestPerSet.set(a.problemSetId, Math.max(bestPerSet.get(a.problemSetId) ?? 0, pct));
    }
  }

  const scores = Array.from(bestPerSet.values());
  return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
}
