import { describe, expect, it } from "vitest";
import { AppError } from "../../server/lib/errors.js";
import { redact } from "../../server/lib/logger.js";
import { createSessionToken, hashPassword, readSessionToken, verifyPassword } from "../../server/lib/security.js";
import {
  decodeImage,
  validateEmail,
  validateFileFormat,
  validateLanguage,
  validatePassword,
  validatePrompt,
} from "../../server/lib/validation.js";
import { classifyQuestion } from "../../server/services/assistantService.js";
import { parseSections, stripCodeFence } from "../../server/services/prompts.js";
import { fuzzyQuery, needsWebSearch, SearchService, searchLanguages, searchTerms } from "../../server/services/searchService.js";
import { operationsOf, parseInstruction, DEFAULT_SETTINGS } from "../../src/services/imageOps.js";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AppError).code;
  }
  return null;
};

describe("validation", () => {
  it("checks email, password and prompt", () => {
    expect(validateEmail(" Student@Mail.KZ ")).toBe("student@mail.kz");
    expect(code(() => validateEmail("not-an-email"))).toBe("VALIDATION");
    expect(code(() => validatePassword("short"))).toBe("VALIDATION");
    expect(code(() => validatePassword("longenough", "different"))).toBe("VALIDATION");
    expect(code(() => validatePrompt("   ", 100))).toBe("VALIDATION");
    expect(code(() => validatePrompt("x".repeat(101), 100))).toBe("VALIDATION");
  });

  it("accepts only the three supported languages and four file formats", () => {
    expect(validateLanguage("kk")).toBe("kk");
    expect(code(() => validateLanguage("de"))).toBe("VALIDATION");
    expect(validateFileFormat("pptx")).toBe("pptx");
    expect(code(() => validateFileFormat("exe"))).toBe("FILE_INVALID");
  });

  it("checks the real image signature, not just the declared type", () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
    expect(decodeImage(`data:image/png;base64,${png.toString("base64")}`, 100).format).toBe("png");
    const fake = Buffer.from("<script>alert(1)</script>");
    expect(code(() => decodeImage(`data:image/png;base64,${fake.toString("base64")}`, 100))).toBe("IMAGE_INVALID");
    expect(code(() => decodeImage(`data:image/png;base64,${png.toString("base64")}`, 5))).toBe("IMAGE_INVALID");
    expect(code(() => decodeImage("data:image/gif;base64,R0lGOD", 100))).toBe("IMAGE_INVALID");
  });
});

describe("security", () => {
  it("hashes passwords with a salt and verifies them", async () => {
    const a = await hashPassword("secret-123");
    const b = await hashPassword("secret-123");
    expect(a).not.toBe(b);
    expect(a).not.toContain("secret-123");
    expect(await verifyPassword("secret-123", a)).toBe(true);
    expect(await verifyPassword("wrong-pass", a)).toBe(false);
  });

  it("signs session tokens and rejects tampering or expiry", () => {
    const token = createSessionToken("user-1", "s".repeat(32), 1000);
    expect(readSessionToken(token, "s".repeat(32), 2000)).toBe("user-1");
    expect(readSessionToken(`${token}x`, "s".repeat(32), 2000)).toBeNull();
    expect(readSessionToken(token, "other-secret-other-secret-123456", 2000)).toBeNull();
    expect(readSessionToken(token, "s".repeat(32), 1000 + 8 * 24 * 3600 * 1000)).toBeNull();
  });

  it("redacts secrets and personal data from logs", () => {
    expect(redact({ password: "x", apiKey: "y", email: "a@b.c", module: "m" })).toEqual({
      password: "[redacted]",
      apiKey: "[redacted]",
      email: "[redacted]",
      module: "m",
    });
  });
});

describe("assistant helpers", () => {
  it("classifies questions to route them to the right tool", () => {
    expect(classifyQuestion("Solve 2x + 5 = 13")).toBe("math");
    expect(classifyQuestion("Python-да функция жаз")).toBe("code");
    expect(classifyQuestion("(A ∧ B) → A")).toBe("logic");
    expect(classifyQuestion("Абай кім?")).toBe("general");
  });

  it("turns on web search for time-sensitive questions", () => {
    expect(needsWebSearch("Қазір Қазақстанның астанасы қай қала?")).toBe(true);
    expect(needsWebSearch("Последние новости науки")).toBe(true);
    expect(needsWebSearch("What happened in 2026?")).toBe(true);
    expect(needsWebSearch("Пифагор теоремасы")).toBe(false);
  });

  it("reduces questions to search terms", () => {
    expect(searchTerms("Фотосинтез деген не?")).toBe("Фотосинтез");
    expect(searchTerms("Абай Құнанбаев кім?")).toBe("Абай Құнанбаев");
    expect(searchTerms("Что такое гравитация?")).toBe("гравитация");
    expect(searchTerms("What is the speed of light?")).toBe("speed of light");
    expect(searchLanguages("kk")).toEqual(["kk", "ru", "en"]);
    expect(searchTerms("казакстан призденті кім?")).toBe("казакстан призденті");
    expect(fuzzyQuery("казакстан призденті")).toBe("казакстан~ призденті~");
    expect(fuzzyQuery("Абай")).toBe("Абай~");
    expect(fuzzyQuery("ДНК")).toBe("ДНК");
  });

  it("falls back to other Wikipedia languages when the first has no article", async () => {
    const asked: string[] = [];
    const provider = {
      async search(query: string, language: string) {
        asked.push(`${language}:${query}`);
        if (language === "kk") return [];
        return [{ title: "Т", url: `https://${language}.wikipedia.org/wiki/T`, domain: `${language}.wikipedia.org`, extract: "x".repeat(60) }];
      },
    };
    const hits = await new SearchService(provider, true).find("Фотосинтез деген не?", "kk");
    expect(asked).toEqual(["kk:Фотосинтез", "kk:Фотосинтез~", "ru:Фотосинтез"]);
    expect(hits[0].domain).toBe("ru.wikipedia.org");
  });

  it("retries a misspelled question with fuzzy matching before switching language", async () => {
    const asked: string[] = [];
    const provider = {
      async search(query: string, language: string) {
        asked.push(`${language}:${query}`);
        if (!query.includes("~")) return [];
        return [{ title: "Қазақстан Президенті", url: `https://${language}.wikipedia.org/wiki/P`, domain: `${language}.wikipedia.org`, extract: "x".repeat(60) }];
      },
    };
    const hits = await new SearchService(provider, true).find("казакстан призденті кім?", "kk");
    expect(asked).toEqual(["kk:казакстан призденті", "kk:казакстан~ призденті~"]);
    expect(hits[0].title).toBe("Қазақстан Президенті");
  });

  it("uses Wikipedia's spelling suggestion for bigger mistakes", async () => {
    const asked: string[] = [];
    const hit = { title: "Қазақстан Президенті", url: "https://kk.wikipedia.org/wiki/P", domain: "kk.wikipedia.org", extract: "x".repeat(60) };
    const provider = {
      async search(query: string, language: string) {
        asked.push(`${language}:${query}`);
        return query === "қазақстан президенті" ? [hit] : [];
      },
      async suggest() {
        return "қазақстан президенті";
      },
    };
    const hits = await new SearchService(provider, true).find("казахистаан прзиидент кім?", "kk");
    expect(hits[0].title).toBe("Қазақстан Президенті");
    expect(asked).toEqual(["kk:казахистаан прзиидент", "kk:казахистаан~ прзиидент~", "kk:қазақстан президенті"]);
  });

  it("falls back to single words when nothing matches the whole question", async () => {
    const asked: string[] = [];
    const provider = {
      async search(query: string, language: string) {
        asked.push(`${language}:${query}`);
        if (query !== "Қазақстан~") return [];
        return [{ title: "Қазақстан", url: "https://kk.wikipedia.org/wiki/K", domain: "kk.wikipedia.org", extract: "x".repeat(60) }];
      },
    };
    const hits = await new SearchService(provider, true).find("Қазақстан ыбырсқа", "kk");
    expect(hits[0].title).toBe("Қазақстан");
    // Every language is tried with the whole question before single words.
    expect(asked).toContain("en:Қазақстан~ ыбырсқа~");
    expect(asked.at(-1)).toBe("kk:Қазақстан~");
  });

  it("parses section markers and code fences from model output", () => {
    const s = parseSections("## SUMMARY\nShort.\n## EXPLANATION\nLong\ntext\n## SECTION: Intro\nP1");
    expect(s.get("SUMMARY")).toBe("Short.");
    expect(s.get("EXPLANATION")).toBe("Long\ntext");
    expect(s.get("SECTION:Intro")).toBe("P1");
    expect(stripCodeFence("```python\nprint(1)\n```")).toBe("print(1)");
  });
});

describe("image instructions", () => {
  it("understands Kazakh, Russian and English instructions", () => {
    expect(parseInstruction("ақ-қара қыл, жарықты көбейт")).toMatchObject({ grayscale: true, brightness: 130 });
    expect(parseInstruction("поверни на 180 и обрежь до квадрата")).toMatchObject({ rotate: 180, crop: true });
    expect(parseInstruction('add the text "History", white background')).toMatchObject({
      text: "History",
      background: "#ffffff",
    });
    expect(parseInstruction("hello")).toEqual({});
  });

  it("lists only the operations that change the image", () => {
    expect(operationsOf(DEFAULT_SETTINGS)).toEqual([]);
    expect(operationsOf({ ...DEFAULT_SETTINGS, sepia: true, text: "Hi" })).toEqual(["sepia", "text"]);
  });
});
