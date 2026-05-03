#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_STATUS = "DRAFT";
const NO_SOLUTIONS_PATTERN = /no solutions found\./i;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const inputDir = path.resolve(process.cwd(), options.inputDir ?? "amc_aime");
  const outputDir = path.resolve(process.cwd(), options.outputDir ?? path.join("amc_aime", "json"));

  const directoryEntries = await fs.readdir(inputDir, { withFileTypes: true });
  const questionFiles = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith("_questions.txt"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (questionFiles.length === 0) {
    throw new Error(`No *_questions.txt files were found in ${inputDir}.`);
  }

  const sets = [];
  const setsByKey = new Map();

  for (const questionFileName of questionFiles) {
    const key = questionFileName.slice(0, -"_questions.txt".length);
    const solutionFileName = `${key}_solutions.txt`;
    const solutionPath = path.join(inputDir, solutionFileName);

    const questionPath = path.join(inputDir, questionFileName);
    const [questionText, solutionText] = await Promise.all([
      fs.readFile(questionPath, "utf8"),
      fs.readFile(solutionPath, "utf8"),
    ]);

    const contestCode = key.replace(/^\d{4}_?/, "");
    const problems = buildProblems({
      questionText,
      solutionText,
      contestCode,
    });

    const setData = {
      key,
      questionFileName,
      solutionFileName,
      slug: key.toLowerCase().replace(/_/g, "-"),
      title: key.replace(/_/g, " "),
      contestTag: contestCode ? contestCode.toLowerCase().replace(/_/g, "-") : null,
      problems,
    };

    sets.push(setData);
    setsByKey.set(key, setData);
  }

  const redirectResolutionCount = resolveRedirectAnswers(setsByKey, sets);

  await fs.mkdir(outputDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    inputDir,
    outputDir,
    strictSets: options.strictSets,
    includeSolutions: options.includeSolutions,
    setCount: sets.length,
    writtenSetCount: 0,
    skippedSetCount: 0,
    totalProblemCount: 0,
    writtenProblemCount: 0,
    unresolvedProblemCount: 0,
    redirectResolutionCount,
    sets: [],
  };

  for (const setData of sets) {
    const unresolvedProblems = [];
    const outputProblems = [];

    for (const problem of setData.problems) {
      report.totalProblemCount += 1;

      if (!problem.answer) {
        unresolvedProblems.push(problem.number);
        report.unresolvedProblemCount += 1;
        continue;
      }

      const outputProblem = {
        number: problem.number,
        statement: normalizeWhitespace(problem.statement),
        answerType: problem.answer.answerType,
        answerKey: problem.answer.answerKey,
        points: 1,
      };

      if (problem.answer.acceptedAnswers.length > 0) {
        outputProblem.acceptedAnswers = problem.answer.acceptedAnswers;
      }

      if (options.includeSolutions && problem.solution) {
        outputProblem.solution = normalizeWhitespace(firstSolutionSegment(problem.solution));
      }

      outputProblems.push(outputProblem);
      report.writtenProblemCount += 1;
    }

    const setSummary = {
      key: setData.key,
      questionFileName: setData.questionFileName,
      solutionFileName: setData.solutionFileName,
      totalProblems: setData.problems.length,
      writtenProblems: outputProblems.length,
      unresolvedProblems,
    };

    const hasUnresolved = unresolvedProblems.length > 0;
    const shouldSkip = outputProblems.length === 0 || (options.strictSets && hasUnresolved);

    if (shouldSkip) {
      report.skippedSetCount += 1;
      setSummary.outputFile = null;
      setSummary.skipped = true;
      report.sets.push(setSummary);
      continue;
    }

    const payload = {
      slug: setData.slug,
      title: setData.title,
      description: `Converted from ${setData.questionFileName} and ${setData.solutionFileName}.`,
      statementFormat: "HTML",
      order: 0,
      status: DEFAULT_STATUS,
      topicTags: setData.contestTag ? [setData.contestTag] : [],
      problems: outputProblems,
    };

    const outputFileName = `${setData.key}.json`;
    const outputPath = path.join(outputDir, outputFileName);
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    report.writtenSetCount += 1;
    setSummary.outputFile = outputFileName;
    setSummary.skipped = false;
    report.sets.push(setSummary);
  }

  const reportPath = path.join(outputDir, "conversion-report.json");
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    [
      `Converted ${report.writtenSetCount}/${report.setCount} sets.`,
      `Wrote ${report.writtenProblemCount}/${report.totalProblemCount} problems.`,
      `Unresolved problems: ${report.unresolvedProblemCount}.`,
      `Report: ${reportPath}`,
    ].join(" "),
  );
}

function parseArgs(argv) {
  const options = {
    inputDir: null,
    outputDir: null,
    strictSets: false,
    includeSolutions: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--help" || current === "-h") {
      options.help = true;
      continue;
    }
    if (current === "--strict") {
      options.strictSets = true;
      continue;
    }
    if (current === "--include-solutions") {
      options.includeSolutions = true;
      continue;
    }
    if (current === "--input") {
      options.inputDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (current === "--output") {
      options.outputDir = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return options;
}

function printHelp() {
  console.log(
    [
      "Convert amc_aime/*.txt files into JSON import files.",
      "",
      "Usage:",
      "  node scripts/convert-amc-aime-to-json.mjs [--input DIR] [--output DIR] [--strict] [--include-solutions]",
      "",
      "Flags:",
      "  --input DIR             Source directory (default: amc_aime)",
      "  --output DIR            Output directory (default: amc_aime/json)",
      "  --strict                Skip any set that has unresolved answers",
      "  --include-solutions     Include the first solution block in each problem",
      "",
      "A conversion-report.json file is always written to the output directory.",
    ].join("\n"),
  );
}

function buildProblems({ questionText, solutionText, contestCode }) {
  const questionBlocks = parseProblemBlocks(questionText);
  const solutionBlocks = parseProblemBlocks(solutionText);
  const problems = [];

  for (const questionBlock of questionBlocks.values()) {
    const solution = solutionBlocks.get(questionBlock.number)?.body ?? "";
    const redirect = parseRedirectTarget(questionBlock.body);

    problems.push({
      number: questionBlock.number,
      statement: questionBlock.body,
      solution,
      redirect,
      answer: NO_SOLUTIONS_PATTERN.test(solution)
        ? null
        : extractAnswerFromSolution(solution, contestCode),
    });
  }

  return problems;
}

function parseProblemBlocks(text) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const matches = [...normalized.matchAll(/^\s*Problem\s+(\d+)\s*$/gim)];
  const blocks = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const problemNumber = Number.parseInt(current[1], 10);
    const start = current.index + current[0].length;
    const end = next ? next.index : normalized.length;
    const body = normalized.slice(start, end).trim();
    blocks.push({ number: problemNumber, body });
  }

  blocks.sort((left, right) => left.number - right.number);
  return new Map(blocks.map((block) => [block.number, block]));
}

function resolveRedirectAnswers(setsByKey, sets) {
  let resolvedCount = 0;
  let changed = true;
  let passes = 0;

  while (changed && passes < 10) {
    changed = false;
    passes += 1;

    for (const setData of sets) {
      for (const problem of setData.problems) {
        if (problem.answer || !problem.redirect) {
          continue;
        }

        const targetSet = setsByKey.get(problem.redirect.targetKey);
        if (!targetSet) {
          continue;
        }

        const targetProblem = targetSet.problems.find(
          (candidate) => candidate.number === problem.redirect.targetProblemNumber,
        );
        if (!targetProblem || !targetProblem.answer) {
          continue;
        }

        problem.answer = {
          answerKey: targetProblem.answer.answerKey,
          acceptedAnswers: [...targetProblem.answer.acceptedAnswers],
          answerType: targetProblem.answer.answerType,
        };
        problem.statement = targetProblem.statement;
        if (!problem.solution) {
          problem.solution = targetProblem.solution;
        }

        resolvedCount += 1;
        changed = true;
      }
    }
  }

  return resolvedCount;
}

function parseRedirectTarget(statement) {
  const redirectMatch = statement.match(/#\s*redirect\s*\[\[([^\]]+)\]\]/i);
  if (!redirectMatch) {
    return null;
  }

  const targetRaw = redirectMatch[1].trim();
  const targetMatch = targetRaw.match(/(.+?)\s*\/\s*Problem\s*(\d+)/i);
  if (!targetMatch) {
    return null;
  }

  const setLabel = targetMatch[1].replace(/\s*Problems?\s*$/i, "").trim();
  const targetKey = setLabel
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const targetProblemNumber = Number.parseInt(targetMatch[2], 10);

  if (!targetKey || !Number.isInteger(targetProblemNumber)) {
    return null;
  }

  return {
    targetKey,
    targetProblemNumber,
  };
}

function extractAnswerFromSolution(solutionText, contestCode) {
  const firstSegment = firstSolutionSegment(solutionText);
  const boxedCandidates = [];
  for (const source of [firstSegment, solutionText]) {
    boxedCandidates.push(...extractAllBraced(source, "\\boxed{"));
    boxedCandidates.push(...extractAllBraced(source, "\\fbox{"));
    boxedCandidates.push(...extractAllBraced(source, "\\bbox{"));
  }

  for (let index = boxedCandidates.length - 1; index >= 0; index -= 1) {
    const parsed = parseAnswerCandidate(boxedCandidates[index]);
    if (parsed) {
      return parsed;
    }
  }

  const phraseCandidates = [];
  for (const source of [firstSegment, solutionText]) {
    for (const regex of ANSWER_REGEXES) {
      for (const match of source.matchAll(regex)) {
        if (match[1]) {
          phraseCandidates.push(match[1]);
        }
      }
    }
  }

  for (let index = phraseCandidates.length - 1; index >= 0; index -= 1) {
    const parsed = parseAnswerCandidate(phraseCandidates[index]);
    if (parsed) {
      return parsed;
    }
  }

  const letterFallback =
    extractChoiceLetter(stripWikiAndHtml(firstSegment)) ||
    extractChoiceLetter(stripWikiAndHtml(solutionText));
  if (letterFallback) {
    return {
      answerKey: letterFallback,
      acceptedAnswers: [],
      answerType: "multiple",
    };
  }

  if (contestCode.includes("AIME")) {
    const fallbackInteger = extractLastUsefulInteger(stripWikiAndHtml(firstSegment));
    if (fallbackInteger !== null) {
      return {
        answerKey: String(fallbackInteger),
        acceptedAnswers: [],
        answerType: "integer",
      };
    }
  }

  return null;
}

const ANSWER_REGEXES = [
  /(?:^|\b)answer(?:\s+choice)?\s*(?:is|=|:)\s*([^\n.]{1,160})/gim,
  /(?:^|\b)our\s+answer\s*(?:is|=|:)\s*([^\n.]{1,160})/gim,
  /(?:^|\b)correct\s+answer\s*(?:is|=|:)\s*([^\n.]{1,160})/gim,
];

function parseAnswerCandidate(rawCandidate) {
  const cleaned = cleanupCandidate(rawCandidate);
  if (!cleaned) {
    return null;
  }

  const choiceMatch = cleaned.match(/\(([A-E])\)/i);
  const choiceLetter = choiceMatch ? choiceMatch[1].toUpperCase() : null;

  let value = cleaned;
  value = value.replace(/\(([A-E])\)/gi, " ");
  value = value.replace(/\bchoice\b/gi, " ");
  value = value.replace(/\banswer\b/gi, " ");
  value = value.replace(/\bis\b/gi, " ");

  if (value.includes("=")) {
    const afterEquals = value.slice(value.lastIndexOf("=") + 1).trim();
    if (afterEquals) {
      value = afterEquals;
    }
  }

  value = normalizeWhitespace(value).replace(/^[,.:;=\-]+|[,.:;=\-]+$/g, "");

  if (!value && choiceLetter) {
    return {
      answerKey: choiceLetter,
      acceptedAnswers: [],
      answerType: "multiple",
    };
  }

  if (!value) {
    return null;
  }

  if (/^[A-E]$/i.test(value)) {
    return {
      answerKey: value.toUpperCase(),
      acceptedAnswers: [],
      answerType: "multiple",
    };
  }

  if (!choiceLetter) {
    const wordCount = value.split(/\s+/).filter(Boolean).length;
    const looksNumericOrCompactExpression =
      /^-?(?:\d+|\d+\.\d*|\d*\.\d+|\d+\/\d+)$/.test(value) ||
      /^[0-9a-zA-Z_\\^+\-*/().{}]+$/.test(value);
    if (!looksNumericOrCompactExpression && wordCount > 4) {
      return null;
    }
  }

  const answerType = determineAnswerType(value);
  const acceptedAnswers = choiceLetter ? [choiceLetter] : [];

  return {
    answerKey: normalizeAnswerForType(value, answerType),
    acceptedAnswers,
    answerType,
  };
}

function cleanupCandidate(rawCandidate) {
  let value = stripWikiAndHtml(rawCandidate);
  value = value.replace(/\\(?:textbf|mathrm|text|displaystyle|boxed|fbox|bbox)\s*/g, "");
  value = value.replace(/\\(?:qquad|quad|,|;|:|!)/g, " ");
  value = value.replace(/[{}]/g, " ");
  value = normalizeWhitespace(value).trim();
  return value;
}

function stripWikiAndHtml(value) {
  return value
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");
}

function firstSolutionSegment(solutionText) {
  const firstMatch = solutionText.match(/\[Solution[^\]]*\]/i);
  if (!firstMatch || firstMatch.index === undefined) {
    return solutionText;
  }

  const start = firstMatch.index + firstMatch[0].length;
  const rest = solutionText.slice(start);
  const nextIndex = rest.search(/\n\s*\[Solution[^\]]*\]/i);
  return nextIndex >= 0 ? rest.slice(0, nextIndex) : rest;
}

function extractAllBraced(text, marker) {
  const results = [];
  let fromIndex = 0;

  while (fromIndex < text.length) {
    const markerIndex = text.indexOf(marker, fromIndex);
    if (markerIndex < 0) {
      break;
    }

    let cursor = markerIndex + marker.length;
    let depth = 1;
    const contentStart = cursor;

    while (cursor < text.length && depth > 0) {
      const current = text[cursor];
      if (current === "{") {
        depth += 1;
      } else if (current === "}") {
        depth -= 1;
      }
      cursor += 1;
    }

    if (depth === 0) {
      results.push(text.slice(contentStart, cursor - 1));
      fromIndex = cursor;
    } else {
      fromIndex = markerIndex + 1;
    }
  }

  return results;
}

function extractChoiceLetter(text) {
  const matches = [...text.matchAll(/\(([A-E])\)/gi)];
  if (matches.length === 0) {
    return null;
  }
  return matches[matches.length - 1][1].toUpperCase();
}

function extractLastUsefulInteger(value) {
  const matches = [...value.matchAll(/(?<!\d)(\d{1,4})(?!\d)/g)].map((match) =>
    Number.parseInt(match[1], 10),
  );
  const filtered = matches.filter((candidate) => candidate < 1900 || candidate > 2100);
  if (filtered.length === 0) {
    return null;
  }
  return filtered[filtered.length - 1];
}

function determineAnswerType(value) {
  const compact = value.replace(/\s+/g, "");
  if (/^-?\d+$/.test(compact)) {
    return "integer";
  }
  if (/^-?(?:\d+\.\d*|\d*\.\d+)$/.test(compact)) {
    return "decimal";
  }
  if (/^-?\d+\/-?\d+$/.test(compact)) {
    return "fraction";
  }
  return "exact";
}

function normalizeAnswerForType(value, answerType) {
  if (answerType === "integer" || answerType === "decimal") {
    return value.replace(/[,\s]/g, "");
  }
  if (answerType === "fraction") {
    return value.replace(/\s*/g, "");
  }
  return normalizeWhitespace(value);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

await main();
