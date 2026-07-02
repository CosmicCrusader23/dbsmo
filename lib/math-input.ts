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

function replaceLatexCommandWithGroup(
  value: string,
  command: string,
  replacement: (inner: string) => string,
): string {
  let result = value;
  let index = result.indexOf(command);

  while (index !== -1) {
    const openIndex = result.indexOf("{", index + command.length);
    if (openIndex === -1) break;

    let depth = 0;
    let closeIndex = -1;
    for (let cursor = openIndex; cursor < result.length; cursor += 1) {
      if (result[cursor] === "{") depth += 1;
      if (result[cursor] === "}") {
        depth -= 1;
        if (depth === 0) {
          closeIndex = cursor;
          break;
        }
      }
    }

    if (closeIndex === -1) break;

    const inner = result.slice(openIndex + 1, closeIndex);
    result = `${result.slice(0, index)}${replacement(inner)}${result.slice(closeIndex + 1)}`;
    index = result.indexOf(command, index + 1);
  }

  return result;
}

function replaceLatexFractions(value: string): string {
  let result = value;
  let index = result.indexOf("\\frac");

  while (index !== -1) {
    const numeratorOpen = result.indexOf("{", index + "\\frac".length);
    if (numeratorOpen === -1) break;

    const numeratorClose = findMatchingBrace(result, numeratorOpen);
    if (numeratorClose === -1) break;

    const denominatorOpen = result.indexOf("{", numeratorClose + 1);
    if (denominatorOpen === -1) break;

    const denominatorClose = findMatchingBrace(result, denominatorOpen);
    if (denominatorClose === -1) break;

    const numerator = result.slice(numeratorOpen + 1, numeratorClose);
    const denominator = result.slice(denominatorOpen + 1, denominatorClose);
    result = `${result.slice(0, index)}((${numerator})/(${denominator}))${result.slice(denominatorClose + 1)}`;
    index = result.indexOf("\\frac", index + 1);
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
  value = replaceLatexCommandWithGroup(value, "\\sqrt", (inner) => `sqrt(${inner})`);
  value = value.replace(/sqrt\s*\{([^{}]+)\}/g, "sqrt($1)");
  value = value.replace(/\^\s*\{([^{}]+)\}/g, "^($1)");
  value = value.replace(/[{}]/g, "");

  return value;
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
    .replace(/\bpi\b/gi, "\\pi")
    .replace(/\*/g, "\\cdot ");

  value = value.replace(/(^|[^\\])\bsqrt\s*\(([^()]+)\)/gi, "$1\\sqrt{$2}");
  value = value.replace(/(^|[^\\])\bsqrt\s*\{([^{}]+)\}/gi, "$1\\sqrt{$2}");
  value = value.replace(/\^\s*\(([^()]+)\)/g, "^{$1}");
  value = value.replace(/\^\s*([^\s+\-*/^]+)/g, "^{$1}");

  return value;
}
