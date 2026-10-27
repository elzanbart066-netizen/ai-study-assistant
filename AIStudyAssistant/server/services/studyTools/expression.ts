// Safe arithmetic expression parser (no eval). Supports + - * / ^, parentheses,
// implicit multiplication (2x, 3(x+1)), unicode operators and common functions.

export type Node =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "neg"; arg: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^"; left: Node; right: Node }
  | { kind: "call"; fn: FnName; arg: Node };

const FUNCTIONS = ["sqrt", "sin", "cos", "tan", "ln", "log", "abs"] as const;
type FnName = (typeof FUNCTIONS)[number];

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "(" }
  | { t: ")" };

export class ParseError extends Error {}

export function normalize(input: string): string {
  return input
    .replace(/[×·∙]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√/g, "sqrt")
    .replace(/(\d),(\d)/g, "$1.$2");
}

export function tokenize(src: string): Token[] {
  const s = normalize(src);
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      const m = /^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\.?/.exec(s.slice(i));
      if (!m) throw new ParseError(`bad number at ${i}`);
      tokens.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-zA-Z]/.test(ch)) {
      const fn = FUNCTIONS.find((f) => s.startsWith(f, i));
      if (fn) {
        tokens.push({ t: "id", v: fn });
        i += fn.length;
      } else if (s.startsWith("pi", i)) {
        tokens.push({ t: "num", v: Math.PI });
        i += 2;
      } else {
        tokens.push({ t: "id", v: ch });
        i++;
      }
    } else if ("+-*/^".includes(ch)) {
      tokens.push({ t: "op", v: ch });
      i++;
    } else if (ch === "(" || ch === "[") {
      tokens.push({ t: "(" });
      i++;
    } else if (ch === ")" || ch === "]") {
      tokens.push({ t: ")" });
      i++;
    } else {
      throw new ParseError(`unexpected "${ch}"`);
    }
  }
  return tokens;
}

export function parse(src: string): Node {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];

  const startsOperand = (tok: Token | undefined) =>
    tok !== undefined && (tok.t === "num" || tok.t === "id" || tok.t === "(");

  function expr(): Node {
    let node = term();
    for (let tok = peek(); tok?.t === "op" && (tok.v === "+" || tok.v === "-"); tok = peek()) {
      pos++;
      node = { kind: "bin", op: tok.v, left: node, right: term() };
    }
    return node;
  }

  function term(): Node {
    let node = unary();
    for (;;) {
      const tok = peek();
      if (tok?.t === "op" && (tok.v === "*" || tok.v === "/")) {
        pos++;
        node = { kind: "bin", op: tok.v, left: node, right: unary() };
      } else if (startsOperand(tok)) {
        // implicit multiplication: 2x, 2(x+1), (a)(b)
        node = { kind: "bin", op: "*", left: node, right: power() };
      } else {
        return node;
      }
    }
  }

  function unary(): Node {
    const tok = peek();
    if (tok?.t === "op" && (tok.v === "-" || tok.v === "+")) {
      pos++;
      const arg = unary();
      return tok.v === "-" ? { kind: "neg", arg } : arg;
    }
    return power();
  }

  function power(): Node {
    const base = primary();
    const tok = peek();
    if (tok?.t === "op" && tok.v === "^") {
      pos++;
      return { kind: "bin", op: "^", left: base, right: unary() };
    }
    return base;
  }

  function primary(): Node {
    const tok = tokens[pos++];
    if (!tok) throw new ParseError("unexpected end");
    if (tok.t === "num") return { kind: "num", value: tok.v };
    if (tok.t === "(") {
      const node = expr();
      if (tokens[pos++]?.t !== ")") throw new ParseError("missing )");
      return node;
    }
    if (tok.t === "id") {
      if ((FUNCTIONS as readonly string[]).includes(tok.v)) {
        const arg = peek()?.t === "(" ? primary() : power();
        return { kind: "call", fn: tok.v as FnName, arg };
      }
      return { kind: "var", name: tok.v };
    }
    throw new ParseError("unexpected operator");
  }

  const node = expr();
  if (pos !== tokens.length) throw new ParseError("trailing input");
  return node;
}

export function evaluate(node: Node, vars: Record<string, number> = {}): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "var": {
      const v = vars[node.name];
      if (v === undefined) throw new ParseError(`unknown variable ${node.name}`);
      return v;
    }
    case "neg":
      return -evaluate(node.arg, vars);
    case "call": {
      const a = evaluate(node.arg, vars);
      const fns: Record<FnName, (x: number) => number> = {
        sqrt: Math.sqrt,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        ln: Math.log,
        log: Math.log10,
        abs: Math.abs,
      };
      return fns[node.fn](a);
    }
    case "bin": {
      const l = evaluate(node.left, vars);
      const r = evaluate(node.right, vars);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return l / r;
        case "^":
          return l ** r;
      }
    }
  }
}

export function variables(node: Node, out = new Set<string>()): Set<string> {
  if (node.kind === "var") out.add(node.name);
  else if (node.kind === "neg" || node.kind === "call") variables(node.arg, out);
  else if (node.kind === "bin") {
    variables(node.left, out);
    variables(node.right, out);
  }
  return out;
}

const OP_SYMBOL = { "+": "+", "-": "−", "*": "·", "/": ":", "^": "^" } as const;

export function format(n: number): string {
  return rawFormat(n).replace(/(^|\s)-/g, "$1−");
}

function rawFormat(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const rounded = Math.round(n * 1e9) / 1e9;
  if (Number.isInteger(rounded)) return String(rounded === 0 ? 0 : rounded);
  for (let q = 2; q <= 100; q++) {
    const p = Math.round(n * q);
    if (Math.abs(n - p / q) < 1e-9) return `${p}/${q} ≈ ${Number(n.toFixed(6))}`;
  }
  return String(Number(n.toPrecision(10)));
}

/** Short number for use inside a step (no "≈" part). */
export function short(n: number): string {
  return format(n).split(" ≈ ")[0];
}

/** Like short(), but wraps fractions and negatives in parentheses for use as a factor. */
export function factor(n: number): string {
  const text = short(n);
  return /[/−]/.test(text) ? `(${text})` : text;
}

export function show(node: Node, parentPrec = 0): string {
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 } as const;
  switch (node.kind) {
    case "num":
      return short(node.value);
    case "var":
      return node.name;
    case "neg":
      return `−${show(node.arg, 3)}`;
    case "call":
      return `${node.fn}(${show(node.arg)})`;
    case "bin": {
      const p = prec[node.op];
      if (node.op === "^" && node.right.kind === "num" && (node.right.value === 2 || node.right.value === 3)) {
        return `${show(node.left, 4)}${node.right.value === 2 ? "²" : "³"}`;
      }
      // 2x, 3(x + 1), 2sqrt(x): write a numeric coefficient next to its factor
      if (node.op === "*" && node.left.kind === "num" && node.right.kind !== "num" && node.right.kind !== "neg") {
        const right = show(node.right, p);
        return `${factor(node.left.value)}${right}`;
      }
      const s = `${show(node.left, p)} ${OP_SYMBOL[node.op]} ${show(node.right, node.op === "^" ? p : p + 0.5)}`;
      return p < parentPrec ? `(${s})` : s;
    }
  }
}

/** Evaluates bottom-up and records each operation as a human-readable step. */
export function evaluateWithSteps(node: Node): { value: number; steps: string[] } {
  const steps: string[] = [];
  const walk = (n: Node): number => {
    if (n.kind === "num") return n.value;
    if (n.kind === "neg") return -walk(n.arg);
    if (n.kind === "call") {
      const a = walk(n.arg);
      const v = evaluate({ kind: "call", fn: n.fn, arg: { kind: "num", value: a } });
      steps.push(`${n.fn}(${short(a)}) = ${short(v)}`);
      return v;
    }
    if (n.kind === "var") throw new ParseError("variable in arithmetic");
    const l = walk(n.left);
    const r = walk(n.right);
    const v = evaluate({ kind: "bin", op: n.op, left: { kind: "num", value: l }, right: { kind: "num", value: r } });
    steps.push(`${short(l)} ${OP_SYMBOL[n.op]} ${short(r)} = ${short(v)}`);
    return v;
  };
  const value = walk(node);
  return { value, steps };
}
