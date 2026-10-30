import type { Language, SolveResult } from "../../../src/models/index.js";
import { phrase } from "./i18n.js";

// Propositional logic: parser + truth table.
type LNode =
  | { k: "var"; name: string }
  | { k: "const"; value: boolean }
  | { k: "not"; arg: LNode }
  | { k: "op"; op: "and" | "or" | "xor" | "imp" | "eq"; l: LNode; r: LNode };

const WORDS: [RegExp, string][] = [
  [/(?<!\p{L})(and|және|и|AND)(?!\p{L})/gu, " & "],
  [/(?<!\p{L})(or|немесе|или|OR)(?!\p{L})/gu, " | "],
  [/(?<!\p{L})(xor|XOR)(?!\p{L})/gu, " ^ "],
  [/(?<!\p{L})(not|емес|не|NOT)(?!\p{L})/gu, " ! "],
  [/<->|<=>|↔|⇔|≡/g, " = "],
  [/->|=>|→|⇒/g, " > "],
  [/∧|&&|·/g, " & "],
  [/∨|\|\||\+/g, " | "],
  [/⊕/g, " ^ "],
  [/¬|~/g, " ! "],
];

const LOGIC_HINT = /∧|∨|¬|→|↔|⇒|⇔|⊕|&&|\|\||->|<->|(?<!\p{L})(and|or|not|xor|және|немесе|емес|или|и|не)(?!\p{L})/iu;

function normalize(input: string): string {
  let s = input;
  for (const [re, rep] of WORDS) s = s.replace(re, rep);
  return s;
}

function parseLogic(src: string): LNode {
  const tokens = src.match(/[A-Z]|[01]|[&|^!>=()]/g) ?? [];
  const leftover = src.replace(/[A-Z]|[01]|[&|^!>=()]|\s/g, "");
  if (leftover.length > 0 || tokens.length === 0) throw new Error("not logic");
  let pos = 0;
  const peek = () => tokens[pos];
  const eq = (): LNode => {
    let n = imp();
    while (peek() === "=") {
      pos++;
      n = { k: "op", op: "eq", l: n, r: imp() };
    }
    return n;
  };
  const imp = (): LNode => {
    const n = or();
    if (peek() === ">") {
      pos++;
      return { k: "op", op: "imp", l: n, r: imp() };
    }
    return n;
  };
  const or = (): LNode => {
    let n = xor();
    while (peek() === "|") {
      pos++;
      n = { k: "op", op: "or", l: n, r: xor() };
    }
    return n;
  };
  const xor = (): LNode => {
    let n = and();
    while (peek() === "^") {
      pos++;
      n = { k: "op", op: "xor", l: n, r: and() };
    }
    return n;
  };
  const and = (): LNode => {
    let n = not();
    while (peek() === "&") {
      pos++;
      n = { k: "op", op: "and", l: n, r: not() };
    }
    return n;
  };
  const not = (): LNode => {
    if (peek() === "!") {
      pos++;
      return { k: "not", arg: not() };
    }
    const t = tokens[pos++];
    if (t === "(") {
      const n = eq();
      if (tokens[pos++] !== ")") throw new Error("missing )");
      return n;
    }
    if (t === "0" || t === "1") return { k: "const", value: t === "1" };
    if (t && /[A-Z]/.test(t)) return { k: "var", name: t };
    throw new Error("unexpected token");
  };
  const node = eq();
  if (pos !== tokens.length) throw new Error("trailing");
  return node;
}

function evalLogic(n: LNode, env: Record<string, boolean>): boolean {
  switch (n.k) {
    case "var":
      return env[n.name];
    case "const":
      return n.value;
    case "not":
      return !evalLogic(n.arg, env);
    case "op": {
      const l = evalLogic(n.l, env);
      const r = evalLogic(n.r, env);
      return { and: l && r, or: l || r, xor: l !== r, imp: !l || r, eq: l === r }[n.op];
    }
  }
}

function collectVars(n: LNode, out = new Set<string>()): Set<string> {
  if (n.k === "var") out.add(n.name);
  else if (n.k === "not") collectVars(n.arg, out);
  else if (n.k === "op") {
    collectVars(n.l, out);
    collectVars(n.r, out);
  }
  return out;
}

function showLogic(n: LNode, top = true): string {
  switch (n.k) {
    case "var":
      return n.name;
    case "const":
      return n.value ? "1" : "0";
    case "not":
      return `¬${showLogic(n.arg, false)}`;
    case "op": {
      const sym = { and: "∧", or: "∨", xor: "⊕", imp: "→", eq: "↔" }[n.op];
      const s = `${showLogic(n.l, false)} ${sym} ${showLogic(n.r, false)}`;
      return top ? s : `(${s})`;
    }
  }
}

/** Builds a truth table for a propositional formula; null if the input is not one. */
export function solveLogic(input: string, lang: Language): SolveResult | null {
  if (!LOGIC_HINT.test(input)) return null;
  const candidate = input.includes(":") ? input.slice(input.lastIndexOf(":") + 1) : input;
  let node: LNode;
  try {
    node = parseLogic(normalize(candidate).replace(/\b([a-z])\b/g, (m) => m.toUpperCase()));
  } catch {
    return null;
  }
  const vars = [...collectVars(node)].sort();
  if (vars.length === 0 || vars.length > 5) return null;
  const rows: string[][] = [];
  let trueCount = 0;
  const total = 2 ** vars.length;
  for (let i = 0; i < total; i++) {
    const env: Record<string, boolean> = {};
    vars.forEach((v, j) => {
      env[v] = Boolean((i >> (vars.length - 1 - j)) & 1);
    });
    const value = evalLogic(node, env);
    if (value) trueCount++;
    rows.push([...vars.map((v) => (env[v] ? "1" : "0")), value ? "1" : "0"]);
  }
  const formula = showLogic(node);
  const answer =
    trueCount === total
      ? phrase(lang, "tautology")
      : trueCount === 0
        ? phrase(lang, "contradiction")
        : phrase(lang, "satisfiable");
  return {
    given: formula,
    method: phrase(lang, "methodLogic"),
    steps: [
      `${phrase(lang, "variables")}: ${vars.join(", ")}`,
      phrase(lang, "rows", { n: vars.length, rows: total }),
      phrase(lang, "trueRows", { k: trueCount, rows: total }),
    ],
    answer,
    check: phrase(lang, "logicCheck"),
    table: { headers: [...vars, formula], rows },
    provider: "offline",
  };
}
