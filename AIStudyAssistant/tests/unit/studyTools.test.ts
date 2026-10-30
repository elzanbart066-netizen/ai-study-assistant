import { describe, expect, it } from "vitest";
import { evaluate, format, parse } from "../../server/services/studyTools/expression.js";
import { extractMath, solveLocally } from "../../server/services/studyTools/mathSolver.js";
import { solveLogic } from "../../server/services/studyTools/logic.js";
import { codeFromTemplate, detectTask } from "../../server/services/studyTools/codeTemplates.js";

describe("expression parser", () => {
  it("respects operator precedence and parentheses", () => {
    expect(evaluate(parse("2 + 3 * 4"))).toBe(14);
    expect(evaluate(parse("(2 + 3) * 4"))).toBe(20);
    expect(evaluate(parse("2^3^2"))).toBe(512);
    expect(evaluate(parse("-2^2"))).toBe(-4);
  });

  it("supports implicit multiplication, unicode operators and functions", () => {
    expect(evaluate(parse("2x"), { x: 5 })).toBe(10);
    expect(evaluate(parse("3(1+1)"))).toBe(6);
    expect(evaluate(parse("12 ÷ 4 × 2 − 1"))).toBe(5);
    expect(evaluate(parse("√16 + 2²"))).toBe(8);
    expect(evaluate(parse("1,5 + 1,5"))).toBe(3);
  });

  it("rejects malformed input", () => {
    expect(() => parse("2 + * 3")).toThrow();
    expect(() => parse("(2 + 3")).toThrow();
    expect(() => parse("2 $ 3")).toThrow();
  });

  it("formats fractions and integers", () => {
    expect(format(4)).toBe("4");
    expect(format(0.25)).toBe("1/4 ≈ 0.25");
    expect(format(-3)).toBe("−3");
  });
});

describe("math solver", () => {
  it("solves the plan's example 2x + 5 = 13 with steps and a check", () => {
    const r = solveLocally("2x + 5 = 13", "kk");
    expect(r?.answer).toBe("x = 4");
    expect(r?.steps).toContain("2x = 8");
    expect(r?.check).toContain("13 = 13");
    expect(r?.check).toContain("✓");
  });

  it("solves linear equations with the unknown on both sides", () => {
    expect(solveLocally("5(x - 2) = 3x + 6", "en")?.answer).toBe("x = 8");
    expect(solveLocally("x/4 + 3 = 7", "ru")?.answer).toBe("x = 16");
  });

  it("detects equations with no solution or infinitely many", () => {
    expect(solveLocally("x + 1 = x + 2", "en")?.answer).toBe("No solution");
    expect(solveLocally("2x + 2 = 2(x + 1)", "en")?.answer).toBe("Every number is a solution");
  });

  it("solves quadratic equations through the discriminant", () => {
    const r = solveLocally("x^2 - 5x + 6 = 0", "en");
    expect(r?.answer).toBe("x1 = 2; x2 = 3");
    expect(r?.steps.some((s) => s.includes("D ="))).toBe(true);
    expect(solveLocally("x² + 1 = 0", "en")?.answer).toBe("No solution");
    expect(solveLocally("x^2 + 4x + 4 = 0", "en")?.answer).toBe("x = −2");
  });

  it("falls back to a numeric method for non-polynomial equations", () => {
    expect(solveLocally("2^x = 8", "en")?.answer).toBe("x ≈ 3");
  });

  it("evaluates arithmetic in order of operations", () => {
    const r = solveLocally("(12 + 8) * 3 - 15 : 5", "kk");
    expect(r?.answer).toBe("57");
    expect(r?.steps[0]).toBe("12 + 8 = 20");
  });

  it("extracts the formula from a sentence", () => {
    expect(extractMath("Теңдеуді шеш: 2x + 5 = 13")).toBe("2x + 5 = 13");
    expect(extractMath("find x if 3x-7=2x+4")).toBe("3x-7=2x+4");
    expect(solveLocally("Сколько будет 7 × 8?", "ru")?.answer).toBe("56");
  });

  it("returns null for word problems that need the AI", () => {
    expect(solveLocally("Абай кім?", "kk")).toBeNull();
    expect(solveLocally("x + y = 3", "en")).toBeNull();
  });
});

describe("logic solver", () => {
  it("recognises a tautology", () => {
    const r = solveLogic("A and B -> A", "en");
    expect(r?.answer).toContain("Tautology");
    expect(r?.table?.rows).toHaveLength(4);
  });

  it("understands Kazakh and Russian connectives", () => {
    expect(solveLogic("(A немесе B) және C", "kk")?.steps[2]).toContain("3 / 8");
    expect(solveLogic("A и не A", "ru")?.answer).toContain("Противоречие");
  });

  it("ignores ordinary sentences", () => {
    expect(solveLogic("Что такое логика и зачем она нужна", "ru")).toBeNull();
  });
});

describe("offline code templates", () => {
  it("detects tasks in three languages", () => {
    expect(detectTask("Факториал числа")).toBe("factorial");
    expect(detectTask("Массивті сұрыптау")).toBe("sort");
    expect(detectTask("check if a number is prime")).toBe("prime");
    expect(detectTask("draw a cat")).toBeNull();
  });

  it("covers the extended task list without false matches", () => {
    expect(detectTask("Екі санның ЕҮОБ табу")).toBe("gcd");
    expect(detectTask("найти НОД двух чисел")).toBe("gcd");
    expect(detectTask("Сортировка списка оценок")).toBe("sort");
    expect(detectTask("Тізімдегі ең үлкен санды табу")).toBe("maxmin");
    expect(detectTask("Сан жұп па, тақ па?")).toBe("evenodd");
    expect(detectTask("Is 2024 a leap year?")).toBe("leapyear");
    expect(detectTask("Көбейту кестесін шығару")).toBe("table");
    expect(detectTask("сумма цифр числа")).toBe("digits");
    expect(detectTask("binary search in an array")).toBe("binsearch");
    expect(detectTask("Цельсийді Фаренгейтке айналдыру")).toBe("temperature");
    expect(detectTask("Сөйлемдегі сөздер санын есептеу")).toBe("words");
    expect(detectTask("Hello world бағдарламасы")).toBe("hello");
    expect(detectTask("seven eleven")).toBeNull();
  });

  it("has code, a sample and an explanation for every task in every language", () => {
    const prompts = ["factorial", "gcd", "binary search", "count words", "celsius", "leap year", "multiplication table", "sum of digits", "maximum", "even", "hello"];
    for (const prompt of prompts) {
      for (const lang of ["python", "javascript", "java", "cpp", "csharp"] as const) {
        const r = codeFromTemplate(prompt, lang, "kk");
        expect(r?.code.length, `${prompt}/${lang}`).toBeGreaterThan(20);
        expect(r?.explanation.length).toBeGreaterThan(10);
        expect(r?.sampleOutput.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns code in the requested language with a sample", () => {
    const r = codeFromTemplate("factorial", "java", "en");
    expect(r?.code).toContain("public class Main");
    expect(r?.sampleOutput).toBe("120");
  });
});
