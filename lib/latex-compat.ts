const MAX_EXPANDED_COLUMNS = 50;

export const KATEX_COMPAT_MACROS: Record<string, string> = {
  "\\toprule": "\\hline",
  "\\midrule": "\\hline",
  "\\bottomrule": "\\hline",
  "\\RR": "\\mathbb{R}",
  "\\NN": "\\mathbb{N}",
  "\\ZZ": "\\mathbb{Z}",
  "\\QQ": "\\mathbb{Q}",
  "\\CC": "\\mathbb{C}",
  "\\degree": "^{\\circ}",
  "\\textdollar": "\\$",
  "\\textpercent": "\\%",
  "\\textdegree": "^{\\circ}",
  "\\textunderscore": "\\_",
  "\\bm": "\\boldsymbol{#1}",
  "\\mathbbm": "\\mathbb{#1}",
  "\\mathds": "\\mathbb{#1}",
  "\\Reals": "\\mathbb{R}",
  "\\Naturals": "\\mathbb{N}",
  "\\Integers": "\\mathbb{Z}",
  "\\Rationals": "\\mathbb{Q}",
  "\\Complex": "\\mathbb{C}",
  "\\abs": "\\left\\lvert #1 \\right\\rvert",
  "\\norm": "\\left\\lVert #1 \\right\\rVert",
  "\\ceil": "\\left\\lceil #1 \\right\\rceil",
  "\\floor": "\\left\\lfloor #1 \\right\\rfloor",
  "\\angles": "\\left\\langle #1 \\right\\rangle",
  "\\braces": "\\left\\{ #1 \\right\\}",
  "\\bracks": "\\left[ #1 \\right]",
  "\\paren": "\\left( #1 \\right)",
  "\\vect": "\\mathbf{#1}",
  "\\conj": "\\overline{#1}",
  "\\given": "\\mid",
  "\\suchthat": "\\mid",
  "\\ang": "{#1}^{\\circ}",
  "\\SI": "#1\\,\\mathrm{#2}",
  "\\unit": "\\mathrm{#1}",
  "\\num": "{#1}",
  "\\dd": "\\mathop{}\\!\\mathrm{d}#1",
  "\\dv": "\\frac{\\mathrm{d} #1}{\\mathrm{d} #2}",
  "\\pdv": "\\frac{\\partial #1}{\\partial #2}",
  "\\metre": "m",
  "\\meter": "m",
  "\\centimetre": "cm",
  "\\centimeter": "cm",
  "\\millimetre": "mm",
  "\\millimeter": "mm",
  "\\kilometre": "km",
  "\\kilometer": "km",
  "\\second": "s",
  "\\gram": "g",
  "\\kilogram": "kg",
  "\\litre": "L",
  "\\liter": "L",
  "\\per": "/",
  "\\squared": "^{2}",
  "\\cubed": "^{3}",
  "\\degreeCelsius": "^{\\circ}C",
  "\\percent": "\\%",
};

type BracedGroup = {
  content: string;
  end: number;
};

function isEscaped(value: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function readBracedGroup(value: string, start: number): BracedGroup | null {
  if (value[start] !== "{") return null;

  let depth = 0;
  for (let cursor = start; cursor < value.length; cursor += 1) {
    if (isEscaped(value, cursor)) continue;
    if (value[cursor] === "{") depth += 1;
    if (value[cursor] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { content: value.slice(start + 1, cursor), end: cursor + 1 };
      }
    }
  }
  return null;
}

function skipWhitespace(value: string, start: number): number {
  let cursor = start;
  while (cursor < value.length && /\s/.test(value[cursor])) cursor += 1;
  return cursor;
}

function normalizeColumnSpec(spec: string): string {
  let result = "";
  let cursor = 0;

  while (cursor < spec.length && result.length < MAX_EXPANDED_COLUMNS * 2) {
    const token = spec[cursor];
    if (/[lcr|:]/.test(token)) {
      result += token;
      cursor += 1;
      continue;
    }
    if (token === "X") {
      result += "l";
      cursor += 1;
      continue;
    }
    if (/[pmb]/.test(token)) {
      const groupStart = skipWhitespace(spec, cursor + 1);
      const group = readBracedGroup(spec, groupStart);
      result += "l";
      cursor = group?.end ?? cursor + 1;
      continue;
    }
    if (/[!@<>]/.test(token)) {
      const groupStart = skipWhitespace(spec, cursor + 1);
      const group = readBracedGroup(spec, groupStart);
      cursor = group?.end ?? cursor + 1;
      continue;
    }
    if (token === "*") {
      const countStart = skipWhitespace(spec, cursor + 1);
      const countGroup = readBracedGroup(spec, countStart);
      const repeatedStart = countGroup ? skipWhitespace(spec, countGroup.end) : countStart;
      const repeatedGroup = readBracedGroup(spec, repeatedStart);
      if (countGroup && repeatedGroup) {
        const count = Math.min(
          MAX_EXPANDED_COLUMNS,
          Math.max(0, Number.parseInt(countGroup.content, 10) || 0),
        );
        result += normalizeColumnSpec(repeatedGroup.content).repeat(count);
        cursor = repeatedGroup.end;
        continue;
      }
    }
    cursor += 1;
  }

  return result || "c";
}

function replaceMulticolumn(value: string): string {
  const command = "\\multicolumn";
  let output = "";
  let cursor = 0;

  while (cursor < value.length) {
    const commandStart = value.indexOf(command, cursor);
    if (commandStart === -1) {
      output += value.slice(cursor);
      break;
    }

    output += value.slice(cursor, commandStart);
    let groupStart = skipWhitespace(value, commandStart + command.length);
    const spanGroup = readBracedGroup(value, groupStart);
    groupStart = spanGroup ? skipWhitespace(value, spanGroup.end) : groupStart;
    const alignmentGroup = readBracedGroup(value, groupStart);
    groupStart = alignmentGroup ? skipWhitespace(value, alignmentGroup.end) : groupStart;
    const contentGroup = readBracedGroup(value, groupStart);

    if (!spanGroup || !alignmentGroup || !contentGroup) {
      output += command;
      cursor = commandStart + command.length;
      continue;
    }

    const span = Math.min(
      MAX_EXPANDED_COLUMNS,
      Math.max(1, Number.parseInt(spanGroup.content, 10) || 1),
    );
    output += `{\\text{${contentGroup.content}}}${"&".repeat(span - 1)}`;
    cursor = contentGroup.end;
  }

  return output;
}

function removeNestedMathDelimiters(value: string): string {
  let output = "";

  for (let cursor = 0; cursor < value.length; cursor += 1) {
    if (value[cursor] === "$" && !isEscaped(value, cursor)) continue;
    if (
      value[cursor] === "\\" &&
      (value[cursor + 1] === "(" || value[cursor + 1] === ")") &&
      !isEscaped(value, cursor)
    ) {
      cursor += 1;
      continue;
    }
    output += value[cursor];
  }

  return output;
}

function convertTabularEnvironment(
  value: string,
  environment: "tabular" | "tabular*" | "tabularx" | "longtable",
): string {
  const escapedName = environment.replace("*", "\\*");
  const prefixGroups = environment === "tabular*" || environment === "tabularx" ? 2 : 1;
  const pattern = new RegExp(
    String.raw`\\begin\{${escapedName}\}([\s\S]*?)\\end\{${escapedName}\}`,
    "g",
  );

  return value.replace(pattern, (match, rawBody: string) => {
    let cursor = 0;
    const groups: BracedGroup[] = [];
    for (let index = 0; index < prefixGroups; index += 1) {
      const groupStart = skipWhitespace(rawBody, cursor);
      const group = readBracedGroup(rawBody, groupStart);
      if (!group) return match;
      groups.push(group);
      cursor = group.end;
    }

    const columnSpec = normalizeColumnSpec(groups[groups.length - 1].content);
    let body = rawBody.slice(cursor);
    body = body.replace(/\\cline\s*\{[^{}]*\}/g, "\\hline");
    body = body.replace(/\\cmidrule(?:\([^)]*\))?\s*\{[^{}]*\}/g, "\\hline");
    body = body.replace(/\\addlinespace(?:\[[^\]]*\])?/g, "");
    body = body.replace(/\\(?:rowcolor|cellcolor)\s*\{[^{}]*\}/g, "");
    body = replaceMulticolumn(body);
    body = removeNestedMathDelimiters(body);
    return `\\begin{array}{${columnSpec}}${body}\\end{array}`;
  });
}

function renameEnvironment(value: string, from: string, to: string): string {
  const escapedFrom = from.replace("*", "\\*");
  return value
    .replace(new RegExp(String.raw`\\begin\{${escapedFrom}\}`, "g"), `\\begin{${to}}`)
    .replace(new RegExp(String.raw`\\end\{${escapedFrom}\}`, "g"), `\\end{${to}}`);
}

export function normalizeLatexStatementSource(value: string): string {
  const documentBody = value.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  let normalized = documentBody ? documentBody[1] : value;
  normalized = normalized.replace(
    /^[ \t]*\\documentclass(?:\[[^\]]*\])?\s*\{[^{}]*\}[ \t]*$/gm,
    "",
  );
  normalized = normalized.replace(/^[ \t]*\\usepackage(?:\[[^\]]*\])?\s*\{[^{}]*\}[ \t]*$/gm, "");
  normalized = normalized.replace(/\\begin\{(?:center|flushleft|flushright)\}/g, "");
  normalized = normalized.replace(/\\end\{(?:center|flushleft|flushright)\}/g, "");
  normalized = normalized.replace(/(?:^|\n)[ \t]*\\centering\s*/g, "\n");
  return normalized.trim();
}

export function normalizeLatexForKatex(value: string): string {
  let normalized = normalizeLatexStatementSource(value);
  normalized = normalized.replace(/(^|[^\\])\\(?=\d)/g, "$1\\$");
  normalized = convertTabularEnvironment(normalized, "tabular*");
  normalized = convertTabularEnvironment(normalized, "tabularx");
  normalized = convertTabularEnvironment(normalized, "longtable");
  normalized = convertTabularEnvironment(normalized, "tabular");
  normalized = renameEnvironment(normalized, "eqnarray*", "aligned");
  normalized = renameEnvironment(normalized, "eqnarray", "aligned");
  normalized = renameEnvironment(normalized, "flalign*", "aligned");
  normalized = renameEnvironment(normalized, "flalign", "aligned");
  normalized = renameEnvironment(normalized, "multline*", "gathered");
  normalized = renameEnvironment(normalized, "multline", "gathered");
  normalized = renameEnvironment(normalized, "displaymath", "gathered");
  return normalized;
}
