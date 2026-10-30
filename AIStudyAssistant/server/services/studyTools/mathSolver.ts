import type { Language, SolveResult } from "../../../src/models/index.js";
import {
  evaluate,
  evaluateWithSteps,
  factor,
  format,
  type Node,
  ParseError,
  parse,
  short,
  show,
  variables,
} from "./expression.js";
import { phrase } from "./i18n.js";
import { solveLogic } from "./logic.js";

/** Polynomial in one variable: coefficients by degree, [c0, c1, c2, ...]. */
type Poly = number[];

const trim = (p: Poly) => {
  const out = [...p];
  while (out.length > 1 && Math.abs(out[out.length - 1]) < 1e-12) out.pop();
  return out;
};
const add = (a: Poly, b: Poly, sign = 1) =>
  trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + sign * (b[i] ?? 0)));
const mul = (a: Poly, b: Poly) => {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return trim(out);
};

/** Converts an expression tree to a polynomial, or null if it is not one. */
export function toPoly(node: Node, v: string): Poly | null {
  switch (node.kind) {
    case "num":
      return [node.value];
    case "var":
      return node.name === v ? [0, 1] : null;
    case "neg": {
      const p = toPoly(node.arg, v);
      return p ? p.map((c) => -c) : null;
    }
    case "call":
      return variables(node.arg).size === 0 ? [evaluate(node)] : null;
    case "bin": {
      const l = toPoly(node.left, v);
      const r = toPoly(node.right, v);
      if (!l || !r) return null;
      if (node.op === "+") return add(l, r);
      if (node.op === "-") return add(l, r, -1);
      if (node.op === "*") return mul(l, r);
      if (node.op === "/") return r.length === 1 && r[0] !== 0 ? l.map((c) => c / r[0]) : null;
      if (r.length === 1 && Number.isInteger(r[0]) && r[0] >= 0 && r[0] <= 6) {
        let out: Poly = [1];
        for (let i = 0; i < r[0]; i++) out = mul(out, l);
        return out;
      }
      return null;
    }
  }
}

function polyText(p: Poly, v: string): string {
  const parts: string[] = [];
  for (let d = p.length - 1; d >= 0; d--) {
    const c = p[d];
    if (Math.abs(c) < 1e-12) continue;
    const abs = Math.abs(c);
    const coef = d > 0 && Math.abs(abs - 1) < 1e-12 ? "" : d > 0 ? factor(abs) : short(abs);
    const term = d === 0 ? short(abs) : d === 1 ? `${coef}${v}` : `${coef}${v}²`;
    parts.push(parts.length === 0 ? (c < 0 ? `−${term}` : term) : `${c < 0 ? "−" : "+"} ${term}`);
  }
  return parts.length ? parts.join(" ") : "0";
}

/**
 * Pulls the mathematical part out of a sentence such as
 * "Теңдеуді шеш: 2x + 5 = 13" or "find x if 2x+5=13".
 */
export function extractMath(input: string): string | null {
  const cleaned = input.replace(/([\d)])\s*:\s*(?=[\d(a-z])/gi, "$1/");
  const runs = cleaned.match(/[0-9a-zA-Z.,+\-*/^()[\]=×÷·−–√²³ ]+/g) ?? [];
  const candidates: string[] = [];
  for (const run of runs) {
    const words = run.trim().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      // Only plain words ("find", "x", "if") may be dropped from the front, never part of a formula.
      if (i > 0 && /[0-9=+\-*/^()[\]]/.test(words[i - 1])) break;
      const candidate = words.slice(i).join(" ").replace(/[.,]+$/, "");
      if (/^[+*/^=]/.test(candidate)) continue;
      if (/[0-9]/.test(candidate) || /[=+\-*/^]/.test(candidate)) candidates.push(candidate);
    }
  }
  const parses = (c: string) => {
    try {
      for (const side of c.split("=")) parse(side);
      return c.split("=").length <= 2;
    } catch {
      return false;
    }
  };
  const varCount = (c: string) => new Set(c.split("=").flatMap((side) => [...variables(parse(side))])).size;
  const valid = candidates.filter(parses).filter((c) => varCount(c) <= 1);
  return valid.find((c) => c.includes("=")) ?? valid.sort((a, b) => b.length - a.length)[0] ?? null;
}

function bisectRoots(f: (x: number) => number): number[] {
  const roots: number[] = [];
  const step = 0.05;
  let prevX = -100;
  let prevY = f(prevX);
  for (let x = -100 + step; x <= 100; x += step) {
    const y = f(x);
    if (Number.isFinite(prevY) && Number.isFinite(y) && Math.sign(prevY) !== Math.sign(y)) {
      let lo = prevX;
      let hi = x;
      for (let i = 0; i < 80; i++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid;
        else hi = mid;
      }
      const root = (lo + hi) / 2;
      if (Math.abs(f(root)) < 1e-6 && !roots.some((r) => Math.abs(r - root) < 1e-6)) roots.push(root);
    }
    prevX = x;
    prevY = y;
  }
  return roots.slice(0, 10);
}

function checkLine(lhs: Node, rhs: Node, v: string, value: number, lang: Language) {
  const l = evaluate(lhs, { [v]: value });
  const r = evaluate(rhs, { [v]: value });
  const ok = Math.abs(l - r) < 1e-6 * Math.max(1, Math.abs(l));
  return `${v} = ${short(value)}: ${show(lhs)} = ${short(l)}, ${show(rhs)} = ${short(r)} — ${ok ? phrase(lang, "checkOk") : "✗"}`;
}

function solveEquation(lhs: Node, rhs: Node, v: string, lang: Language): SolveResult {
  const given = `${show(lhs)} = ${show(rhs)}`;
  const pl = toPoly(lhs, v);
  const pr = toPoly(rhs, v);
  const p = pl && pr ? add(pl, pr, -1) : null;

  if (p && p.length <= 2) {
    const a1 = pl?.[1] ?? 0;
    const a2 = pr?.[1] ?? 0;
    const b1 = pl?.[0] ?? 0;
    const b2 = pr?.[0] ?? 0;
    const a = a1 - a2;
    const b = b2 - b1;
    const minus = (n: number) => (Math.abs(n) < 1e-12 ? "" : n < 0 ? ` + ${factor(-n)}` : ` − ${factor(n)}`);
    const xSide = `${polyText([0, a1], v)}${minus(a2) && minus(a2) + v}`;
    const steps = [
      `${phrase(lang, "moveTerms")}: ${xSide} = ${short(b2)}${minus(b1)}`,
      `${polyText([0, a], v)} = ${short(b)}`,
    ];
    if (Math.abs(a) < 1e-12) {
      const answer = Math.abs(b) < 1e-12 ? phrase(lang, "anySolution") : phrase(lang, "noSolution");
      return { given, method: phrase(lang, "methodLinear"), steps, answer, check: `0 · ${v} = ${short(b)}`, provider: "offline" };
    }
    const x = b / a;
    if (Math.abs(a - 1) > 1e-12) steps.push(`${phrase(lang, "divide", { a: factor(a) })}: ${v} = ${short(b)} : ${factor(a)} = ${short(x)}`);
    return {
      given,
      method: phrase(lang, "methodLinear"),
      steps,
      answer: `${v} = ${format(x)}`,
      check: checkLine(lhs, rhs, v, x, lang),
      provider: "offline",
    };
  }

  if (p && p.length === 3) {
    const [c, b, a] = p;
    const d = b * b - 4 * a * c;
    const steps = [
      `${phrase(lang, "standardForm")}: ${polyText(p, v)} = 0  (a = ${short(a)}, b = ${short(b)}, c = ${short(c)})`,
      `${phrase(lang, "discriminant")}: D = ${factor(b)}² − 4 · ${factor(a)} · ${factor(c)} = ${short(d)}`,
    ];
    if (d < -1e-12) {
      steps.push(phrase(lang, "noRealRoots"));
      return { given, method: phrase(lang, "methodQuadratic"), steps, answer: phrase(lang, "noSolution"), check: `D = ${short(d)} < 0`, provider: "offline" };
    }
    const sq = Math.sqrt(Math.max(d, 0));
    const roots = d < 1e-12 ? [-b / (2 * a)] : [(-b - sq) / (2 * a), (-b + sq) / (2 * a)];
    steps.push(`${phrase(lang, "roots")}: ${v} = (−b ± √D) / 2a = (${short(-b)} ± ${short(sq)}) / ${factor(2 * a)}`);
    roots.forEach((r, i) => steps.push(`${v}${roots.length > 1 ? i + 1 : ""} = ${format(r)}`));
    return {
      given,
      method: phrase(lang, "methodQuadratic"),
      steps,
      answer: roots.map((r, i) => `${v}${roots.length > 1 ? i + 1 : ""} = ${format(r)}`).join("; "),
      check: roots.map((r) => checkLine(lhs, rhs, v, r, lang)).join("\n"),
      provider: "offline",
    };
  }

  const f = (x: number) => evaluate(lhs, { [v]: x }) - evaluate(rhs, { [v]: x });
  const roots = bisectRoots(f);
  return {
    given,
    method: phrase(lang, "methodNumeric"),
    steps: [`f(${v}) = ${show(lhs)} − (${show(rhs)})`, `${phrase(lang, "numericFound")}: ${roots.length}`],
    answer: roots.length ? roots.map((r) => `${v} ≈ ${Number(r.toFixed(6))}`).join("; ") : phrase(lang, "noSolution"),
    check: roots.map((r) => checkLine(lhs, rhs, v, r, lang)).join("\n") || "—",
    provider: "offline",
  };
}

function solveArithmetic(node: Node, lang: Language): SolveResult {
  const { value, steps } = evaluateWithSteps(node);
  let check = `${show(node)} = ${short(value)}`;
  if (node.kind === "bin" && node.op !== "^") {
    const r = evaluate(node.right);
    const inverse = { "+": "−", "-": "+", "*": ":", "/": "·" }[node.op];
    const back = { "+": value - r, "-": value + r, "*": value / r, "/": value * r }[node.op];
    check = `${phrase(lang, "checkInverse")}: ${short(value)} ${inverse} ${short(r)} = ${short(back)} — ${
      Math.abs(back - evaluate(node.left)) < 1e-9 ? phrase(lang, "checkOk") : "✗"
    }`;
  }
  return {
    given: show(node),
    method: phrase(lang, "methodArithmetic"),
    steps: steps.length ? steps : [show(node)],
    answer: format(value),
    check,
    provider: "offline",
  };
}

/**
 * Solves arithmetic, linear/quadratic equations and logical expressions locally.
 * Returns null when the task is a word problem that needs the AI model.
 */
export function solveLocally(input: string, lang: Language): SolveResult | null {
  const logic = solveLogic(input, lang);
  if (logic) return logic;
  const math = extractMath(input);
  if (!math) return null;
  try {
    const sides = math.split("=");
    if (sides.length === 2) {
      const lhs = parse(sides[0]);
      const rhs = parse(sides[1]);
      const vars = new Set([...variables(lhs), ...variables(rhs)]);
      if (vars.size !== 1) return null;
      return solveEquation(lhs, rhs, [...vars][0], lang);
    }
    const node = parse(math);
    if (variables(node).size > 0) return null;
    // A single number is not a task.
    if (node.kind === "num") return null;
    return solveArithmetic(node, lang);
  } catch (error) {
    if (error instanceof ParseError) return null;
    throw error;
  }
}
