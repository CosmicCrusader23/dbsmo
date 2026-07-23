import katex from "katex";
import "katex/contrib/mhchem";
import {
  normalizeProblemContentFormat,
  type ProblemContentFormat,
} from "@/lib/problem-content-format";
import {
  KATEX_COMPAT_MACROS,
  normalizeLatexForKatex,
  normalizeLatexStatementSource,
} from "@/lib/latex-compat";

const DISPLAY_ENVIRONMENTS = new Set([
  "tabular",
  "tabular*",
  "tabularx",
  "longtable",
  "array",
  "darray",
  "matrix",
  "matrix*",
  "pmatrix",
  "pmatrix*",
  "bmatrix",
  "bmatrix*",
  "Bmatrix",
  "Bmatrix*",
  "vmatrix",
  "vmatrix*",
  "Vmatrix",
  "Vmatrix*",
  "smallmatrix",
  "subarray",
  "align",
  "align*",
  "alignat",
  "alignat*",
  "aligned",
  "alignedat",
  "flalign",
  "flalign*",
  "gather",
  "gather*",
  "gathered",
  "multline",
  "multline*",
  "equation",
  "equation*",
  "eqnarray",
  "eqnarray*",
  "displaymath",
  "split",
  "cases",
  "dcases",
  "rcases",
  "CD",
]);
const BEGIN_ENVIRONMENT_REGEX = /^\\begin\{([A-Za-z*]+)\}/;
const IMG_TOKEN_AT_START_REGEX = /^\[\[img:([a-z0-9][a-z0-9_-]{0,63})\]\]/;

type LatexStatementProps = {
  statement: string;
  format?: ProblemContentFormat | string | null;
  assets?: Record<string, string>;
};

type StatementSegment =
  | { kind: "text"; value: string }
  | { kind: "math"; tex: string; displayMode: boolean }
  | { kind: "image"; key: string; raw: string };

function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(normalizeLatexForKatex(tex), {
    throwOnError: false,
    strict: "ignore",
    displayMode,
    trust: false,
    maxSize: 50,
    maxExpand: 1000,
    macros: { ...KATEX_COMPAT_MACROS },
    globalGroup: false,
  });
}

function isEscaped(value: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function findCommandDelimiterEnd(value: string, start: number, closing: string): number | null {
  let cursor = start;
  while (cursor < value.length) {
    const match = value.indexOf(closing, cursor);
    if (match === -1) return null;
    if (!isEscaped(value, match)) return match;
    cursor = match + closing.length;
  }
  return null;
}

function findDollarDelimiterEnd(value: string, start: number, displayMode: boolean): number | null {
  const currencyOpening = !displayMode && /\d/.test(value[start] ?? "");
  let cursor = start;
  while (cursor < value.length) {
    const match = value.indexOf("$", cursor);
    if (match === -1) return null;
    if (!isEscaped(value, match)) {
      if (displayMode && value.startsWith("$$", match)) return match;
      if (!displayMode && value[match - 1] !== "$" && value[match + 1] !== "$") {
        if (currencyOpening && /\d/.test(value[match + 1] ?? "")) {
          cursor = match + 1;
          continue;
        }
        return match;
      }
    }
    cursor = match + 1;
  }
  return null;
}

function findEnvironmentEnd(
  value: string,
  start: number,
  environment: string,
): { end: number } | null {
  const opening = `\\begin{${environment}}`;
  const closing = `\\end{${environment}}`;
  let depth = 1;
  let cursor = start;

  while (cursor < value.length) {
    const nextOpening = value.indexOf(opening, cursor);
    const nextClosing = value.indexOf(closing, cursor);
    if (nextClosing === -1) return null;

    if (nextOpening !== -1 && nextOpening < nextClosing) {
      depth += 1;
      cursor = nextOpening + opening.length;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return { end: nextClosing + closing.length };
    }
    cursor = nextClosing + closing.length;
  }

  return null;
}

function tokenizeStatement(value: string): StatementSegment[] {
  const segments: StatementSegment[] = [];
  let textStart = 0;
  let cursor = 0;

  const pushText = (end: number) => {
    if (end > textStart) {
      segments.push({ kind: "text", value: value.slice(textStart, end) });
    }
  };

  while (cursor < value.length) {
    const imageMatch = value.slice(cursor).match(IMG_TOKEN_AT_START_REGEX);
    if (imageMatch) {
      pushText(cursor);
      segments.push({ kind: "image", key: imageMatch[1], raw: imageMatch[0] });
      cursor += imageMatch[0].length;
      textStart = cursor;
      continue;
    }

    const commandDelimiter =
      !isEscaped(value, cursor) && value.startsWith("\\[", cursor)
        ? { opening: "\\[", closing: "\\]", displayMode: true }
        : !isEscaped(value, cursor) && value.startsWith("\\(", cursor)
          ? { opening: "\\(", closing: "\\)", displayMode: false }
          : null;
    if (commandDelimiter) {
      const contentStart = cursor + commandDelimiter.opening.length;
      const contentEnd = findCommandDelimiterEnd(value, contentStart, commandDelimiter.closing);
      if (contentEnd !== null) {
        pushText(cursor);
        segments.push({
          kind: "math",
          tex: value.slice(contentStart, contentEnd).trim(),
          displayMode: commandDelimiter.displayMode,
        });
        cursor = contentEnd + commandDelimiter.closing.length;
        textStart = cursor;
        continue;
      }
    }

    if (value[cursor] === "$" && value[cursor - 1] !== "$" && !isEscaped(value, cursor)) {
      const displayMode = value.startsWith("$$", cursor);
      const openingLength = displayMode ? 2 : 1;
      const contentStart = cursor + openingLength;
      const contentEnd = findDollarDelimiterEnd(value, contentStart, displayMode);
      if (contentEnd !== null) {
        pushText(cursor);
        segments.push({
          kind: "math",
          tex: value.slice(contentStart, contentEnd).trim(),
          displayMode,
        });
        cursor = contentEnd + openingLength;
        textStart = cursor;
        continue;
      }
    }

    if (!isEscaped(value, cursor) && value.startsWith("\\begin{", cursor)) {
      const environmentMatch = value.slice(cursor).match(BEGIN_ENVIRONMENT_REGEX);
      const environment = environmentMatch?.[1];
      if (environment && DISPLAY_ENVIRONMENTS.has(environment)) {
        const contentStart = cursor + environmentMatch[0].length;
        const environmentEnd = findEnvironmentEnd(value, contentStart, environment);
        if (environmentEnd) {
          pushText(cursor);
          segments.push({
            kind: "math",
            tex: value.slice(cursor, environmentEnd.end).trim(),
            displayMode: true,
          });
          cursor = environmentEnd.end;
          textStart = cursor;
          continue;
        }
      }
    }

    cursor += 1;
  }

  pushText(value.length);
  return segments;
}

function looksLikeStandaloneMath(value: string) {
  return (
    /^\\[a-zA-Z]+/.test(value) ||
    (/^[\s\d\\^_{}=+\-*/().,|<>:;]+$/.test(value) && /[\\^_{}=+\-*/]/.test(value))
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeHtmlStatement(raw: string): string {
  let value = raw;
  value = value.replace(/<!--[\s\S]*?-->/g, " ");
  value = value.replace(/<asy\b[^>]*>[\s\S]*?<\/asy>/gi, " ");
  value = value.replace(/<cmath\b[^>]*>([\s\S]*?)<\/cmath>/gi, (_, math: string) => {
    const tex = math.trim();
    return tex ? ` \\[${tex}\\] ` : " ";
  });
  value = value.replace(
    /<(?:imath|math)\b[^>]*>([\s\S]*?)<\/(?:imath|math)>/gi,
    (_, math: string) => {
      const tex = math.trim();
      return tex ? ` \\(${tex}\\) ` : " ";
    },
  );
  value = value.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (match, target: string, label: string) =>
    target.startsWith("img:") ? match : label,
  );
  value = value.replace(/\[\[([^\]]+)\]\]/g, (match, target: string) =>
    target.startsWith("img:") ? match : target,
  );
  value = value.replace(
    /<\/?(?:br|p|div|center|li|ul|ol|section|article|tr|td|th|table)\b[^>]*>/gi,
    "\n",
  );
  value = value.replace(/<[^>]+>/g, " ");
  value = decodeHtmlEntities(value);
  value = value.replace(/\r\n?/g, "\n");
  value = value.replace(/[ \t]+\n/g, "\n");
  value = value.replace(/\n{3,}/g, "\n\n");
  return value.trim();
}

function normalizeStatementInput(statement: string, format: ProblemContentFormat): string {
  const value = statement.trim();
  if (!value) {
    return "";
  }
  if (format === "HTML") {
    return normalizeHtmlStatement(value);
  }
  return normalizeLatexStatementSource(value);
}

export function LatexStatement({ statement, format, assets }: LatexStatementProps) {
  const normalizedFormat = normalizeProblemContentFormat(format);
  const value = normalizeStatementInput(statement, normalizedFormat);
  if (!value) {
    return <>No statement entered for this problem.</>;
  }

  const segments = tokenizeStatement(value);
  const hasRichContent = segments.some((segment) => segment.kind !== "text");

  if (!hasRichContent) {
    if (looksLikeStandaloneMath(value)) {
      return <span dangerouslySetInnerHTML={{ __html: renderMath(value, true) }} />;
    }
    return <>{value}</>;
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "image") {
          const url = assets?.[segment.key];
          if (url) {
            /* eslint-disable-next-line @next/next/no-img-element */
            return <img key={`img-${index}`} src={url} alt="" className="problem-image" />;
          }
          return <span key={`img-${index}`}>{segment.raw}</span>;
        }
        if (segment.kind === "math") {
          return (
            <span
              className={segment.displayMode ? "statement-math-block" : "statement-math-inline"}
              key={`math-${index}`}
              dangerouslySetInnerHTML={{
                __html: renderMath(segment.tex, segment.displayMode),
              }}
            />
          );
        }
        return <span key={`text-${index}`}>{segment.value}</span>;
      })}
    </>
  );
}
