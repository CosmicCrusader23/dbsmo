export function stripMathDelimiters(raw: string): string {
  let value = raw.trim();
  let changed = true;

  while (changed) {
    changed = false;
    const pairs: Array<[string, string]> = [
      ["$$", "$$"],
      ["\\[", "\\]"],
      ["\\(", "\\)"],
      ["$", "$"],
    ];

    for (const [open, close] of pairs) {
      if (
        value.startsWith(open) &&
        value.endsWith(close) &&
        value.length >= open.length + close.length
      ) {
        value = value.slice(open.length, value.length - close.length).trim();
        changed = true;
      }
    }
  }

  return value;
}

type RootReplacement = (radicand: string, degree: string | null) => string;

function findMatchingDelimiter(
  value: string,
  openIndex: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  for (let index = openIndex; index < value.length; index += 1) {
    if (value[index] === open) depth += 1;
    if (value[index] === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function readRootAtom(value: string, start: number): { atom: string; end: number } | null {
  const match = value
    .slice(start)
    .match(/^(?:\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?|pi|e)/i);
  if (!match) return null;
  return { atom: match[0], end: start + match[0].length };
}

function replacePlainRoots(value: string, replacement: RootReplacement): string {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const remaining = value.slice(index);
    const commandMatch = remaining.match(/^(sqrt|cbrt)/i);
    const previous = index > 0 ? value[index - 1] : "";
    if (!commandMatch || /[a-z\\]/i.test(previous)) {
      result += value[index];
      index += 1;
      continue;
    }

    const command = commandMatch[1].toLowerCase();
    let cursor = index + commandMatch[0].length;
    let degree: string | null = command === "cbrt" ? "3" : null;

    while (/\s/.test(value[cursor] ?? "")) cursor += 1;
    if (command === "sqrt" && value[cursor] === "[") {
      const degreeClose = findMatchingDelimiter(value, cursor, "[", "]");
      if (degreeClose === -1) {
        result += value[index];
        index += 1;
        continue;
      }
      degree = value.slice(cursor + 1, degreeClose).trim();
      cursor = degreeClose + 1;
      while (/\s/.test(value[cursor] ?? "")) cursor += 1;
    }

    let radicand = "";
    let end = cursor;
    const open = value[cursor];
    if (open === "(" || open === "{") {
      const close = open === "(" ? ")" : "}";
      const argumentClose = findMatchingDelimiter(value, cursor, open, close);
      if (argumentClose !== -1) {
        radicand = value.slice(cursor + 1, argumentClose);
        end = argumentClose + 1;
      }
    } else {
      const atom = readRootAtom(value, cursor);
      if (atom) {
        radicand = atom.atom;
        end = atom.end;
      }
    }

    if (!radicand || (degree !== null && !degree)) {
      result += value[index];
      index += 1;
      continue;
    }

    result += replacement(replacePlainRoots(radicand, replacement), degree);
    index = end;
  }

  return result;
}

function replaceLatexRoots(value: string): string {
  let result = value;
  let index = result.indexOf("\\sqrt");

  while (index !== -1) {
    let cursor = index + "\\sqrt".length;
    while (/\s/.test(result[cursor] ?? "")) cursor += 1;

    let degree: string | null = null;
    if (result[cursor] === "[") {
      const degreeClose = findMatchingDelimiter(result, cursor, "[", "]");
      if (degreeClose === -1) break;
      degree = result.slice(cursor + 1, degreeClose).trim();
      cursor = degreeClose + 1;
      while (/\s/.test(result[cursor] ?? "")) cursor += 1;
    }

    let radicand = "";
    let end = cursor;
    if (result[cursor] === "{") {
      const radicandClose = findMatchingBrace(result, cursor);
      if (radicandClose === -1) break;
      radicand = result.slice(cursor + 1, radicandClose);
      end = radicandClose + 1;
    } else {
      const atom = readRootAtom(result, cursor);
      if (!atom) {
        index = result.indexOf("\\sqrt", index + "\\sqrt".length);
        continue;
      }
      radicand = atom.atom;
      end = atom.end;
    }

    const normalizedRadicand = replaceLatexRoots(radicand);
    const normalizedDegree = degree ? replaceLatexRoots(degree) : null;
    const replacement = normalizedDegree
      ? `root((${normalizedRadicand}),(${normalizedDegree}))`
      : `sqrt(${normalizedRadicand})`;
    result = `${result.slice(0, index)}${replacement}${result.slice(end)}`;
    index = result.indexOf("\\sqrt", index + replacement.length);
  }

  return result;
}

function replaceLatexFractions(value: string): string {
  let result = value;
  const fractionCommand = /\\(?:dfrac|tfrac|frac)(?![a-z])/g;
  let commandMatch = fractionCommand.exec(result);

  while (commandMatch) {
    const index = commandMatch.index;
    let cursor = index + commandMatch[0].length;
    while (/\s/.test(result[cursor] ?? "")) cursor += 1;
    if (result[cursor] !== "{") {
      commandMatch = fractionCommand.exec(result);
      continue;
    }

    const numeratorOpen = cursor;
    const numeratorClose = findMatchingBrace(result, numeratorOpen);
    if (numeratorClose === -1) {
      commandMatch = fractionCommand.exec(result);
      continue;
    }

    cursor = numeratorClose + 1;
    while (/\s/.test(result[cursor] ?? "")) cursor += 1;
    if (result[cursor] !== "{") {
      commandMatch = fractionCommand.exec(result);
      continue;
    }

    const denominatorOpen = cursor;
    const denominatorClose = findMatchingBrace(result, denominatorOpen);
    if (denominatorClose === -1) {
      commandMatch = fractionCommand.exec(result);
      continue;
    }

    const numerator = result.slice(numeratorOpen + 1, numeratorClose);
    const denominator = result.slice(denominatorOpen + 1, denominatorClose);
    result = `${result.slice(0, index)}((${numerator})/(${denominator}))${result.slice(denominatorClose + 1)}`;
    fractionCommand.lastIndex = index + 1;
    commandMatch = fractionCommand.exec(result);
  }

  return result;
}

function findMatchingBrace(value: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < value.length; index += 1) {
    if (value[index] === "{") depth += 1;
    if (value[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function normalizeMathInputForEvaluation(raw: string): string {
  let value = stripMathDelimiters(raw)
    .trim()
    .toLowerCase()
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\,/g, "")
    .replace(/[，]/g, ",")
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi|π/g, "pi")
    .replace(/\*\*/g, "^");

  value = replaceLatexFractions(value);
  value = replaceLatexRoots(value);
  value = replacePlainRoots(value, (radicand, degree) =>
    degree ? `root((${radicand}),(${degree}))` : `sqrt(${radicand})`,
  );
  value = value.replace(/\^\s*\{([^{}]+)\}/g, "^($1)");

  return value;
}

function replacePlainPiForPreview(value: string): string {
  return value.replace(/(^|[^\\a-z])pi\b/gi, "$1\\pi");
}

export function mathInputToTex(raw: string): string {
  let value = stripMathDelimiters(raw).trim();

  if (!value) {
    return "";
  }

  value = value
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/π/g, "\\pi")
    .replace(/\*/g, "\\cdot ");
  value = replacePlainPiForPreview(value);

  value = replacePlainRoots(value, (radicand, degree) =>
    degree
      ? `\\sqrt[${degree}]{${radicand.toLowerCase() === "pi" ? "\\pi" : radicand}}`
      : `\\sqrt{${radicand.toLowerCase() === "pi" ? "\\pi" : radicand}}`,
  );
  value = replacePlainPiForPreview(value);
  value = value.replace(/\^\s*\(([^()]+)\)/g, "^{$1}");
  value = value.replace(/\^\s*([^\s+\-*/^]+)/g, "^{$1}");

  return value;
}
