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
import { AssistantService, classifyQuestion } from "../../server/services/assistantService.js";
import { parseSections, stripCodeFence } from "../../server/services/prompts.js";
import { fuzzyQuery, needsWebSearch, SearchService, searchLanguages, searchTerms } from "../../server/services/searchService.js";
import { operationsOf, parseInstruction, parseRecolor, DEFAULT_SETTINGS } from "../../src/services/imageOps.js";
import { recolorPixels, resizeMask, targetShare } from "../../src/services/aiImageEdit.js";

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
    // All languages are asked at once; the student's language would win if it had an article.
    expect(asked).toEqual(["kk:Фотосинтез", "ru:Фотосинтез", "en:Фотосинтез"]);
    expect(hits[0].domain).toBe("ru.wikipedia.org");
  });

  it("prefers the student's language when several Wikipedias have an article", async () => {
    const provider = {
      async search(_query: string, language: string) {
        return [{ title: language, url: `https://${language}.wikipedia.org/wiki/T`, domain: `${language}.wikipedia.org`, extract: "x".repeat(60) }];
      },
    };
    const hits = await new SearchService(provider, true).find("Абай", "kk");
    expect(hits[0].domain).toBe("kk.wikipedia.org");
  });

  it("gives up when the search takes longer than its time budget", async () => {
    let calls = 0;
    const provider = {
      async search() {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [];
      },
    };
    await expect(new SearchService(provider, true).find("Қазақстан ыбырсқа мысал", "kk", 3, 20)).rejects.toMatchObject({ code: "NO_SOURCES" });
    expect(calls).toBe(3);
  });

  it("retries a misspelled question with fuzzy matching", async () => {
    const asked: string[] = [];
    const provider = {
      async search(query: string, language: string) {
        asked.push(`${language}:${query}`);
        if (!query.includes("~")) return [];
        return [{ title: "Қазақстан Президенті", url: `https://${language}.wikipedia.org/wiki/P`, domain: `${language}.wikipedia.org`, extract: "x".repeat(60) }];
      },
    };
    const hits = await new SearchService(provider, true).find("казакстан призденті кім?", "kk");
    expect(asked.slice(0, 3).every((q) => !q.includes("~"))).toBe(true);
    expect(asked[3]).toBe("kk:казакстан~ призденті~");
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
    expect(asked).toContain("kk:қазақстан президенті");
    expect(asked.indexOf("kk:қазақстан президенті")).toBeGreaterThan(asked.indexOf("en:казахистаан~ прзиидент~"));
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
    expect(asked.indexOf("kk:Қазақстан~")).toBeGreaterThan(asked.indexOf("en:Қазақстан~ ыбырсқа~"));
  });

  it("answers from Wikipedia when the AI is too slow or fails", async () => {
    const ai = {
      available: true,
      complete: () => Promise.reject(new AppError("AI_UNAVAILABLE", "timeout")),
    };
    const provider = {
      async search() {
        return [{ title: "Абай", url: "https://kk.wikipedia.org/wiki/A", domain: "kk.wikipedia.org", extract: "Абай Құнанбайұлы — ақын. Ол ағартушы болған." }];
      },
    };
    const result = await new AssistantService(ai, new SearchService(provider, true)).ask({ prompt: "Абай кім?", language: "kk", webSearch: false });
    expect(result.provider).toBe("offline");
    expect(result.sources[0].title).toBe("Абай");
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

  it("understands which part to recolour and into which colour", () => {
    expect(parseRecolor("шашын қара түске боя")).toEqual({ target: "hair", color: "#1c1c1c", word: "шашын" });
    expect(parseRecolor("покрась волосы в чёрный")).toMatchObject({ target: "hair", color: "#1c1c1c" });
    expect(parseRecolor("make the sky pink")).toMatchObject({ target: "sky", color: "#ef7fb0" });
    // A colour before the part describes it; the one after is the new colour.
    expect(parseRecolor("қызыл көйлекті көк түске боя")).toMatchObject({ target: "red dress", color: "#2f63d6" });
    expect(parseRecolor("бас киімін қызыл қыл")).toMatchObject({ target: "hat", word: "бас киімін" });
    // Kazakh typed on a Russian keyboard.
    expect(parseRecolor("шашын кара туске боя")).toMatchObject({ target: "hair", color: "#1c1c1c", word: "шашын" });
    expect(parseRecolor("бас киимин кызыл кыл")).toMatchObject({ target: "hat", color: "#d33a3a" });
    expect(parseRecolor("фонды ақ қыл")).toBeNull();
    expect(parseRecolor("ақ-қара қыл")).toBeNull();
    expect(parseRecolor("суретті қара түске боя")).toBeNull();
  });

  it("recolours the whole part, even where the model was unsure, and nothing else", () => {
    // 40x40 picture: green hair in two shades, skin under it, white background,
    // and a green object far away in the corner.
    const W = 40;
    const color = (x: number, y: number) => {
      if (y >= 4 && y <= 15 && x >= 8 && x <= 31) return y % 2 ? [70, 170, 100] : [90, 200, 120];
      if (y >= 16 && y <= 28 && x >= 10 && x <= 29) return [230, 190, 160];
      if (y >= 36 && x <= 5) return [90, 200, 120];
      return [240, 240, 240];
    };
    const data = new Uint8ClampedArray(W * W * 4);
    for (let i = 0; i < W * W; i++) data.set([...color(i % W, Math.floor(i / W)), 255], i * 4);
    // The model's 10x10 mask: sure about the edge of the hair, unsure in its middle.
    const mask = new Float32Array(100).map((_, i) => {
      const [cx, cy] = [i % 10, Math.floor(i / 10)];
      if (cy === 2 && (cx === 4 || cx === 5)) return 0.05;
      return cy >= 1 && cy <= 3 && cx >= 2 && cx <= 7 ? 0.6 : 0.02;
    });
    expect(recolorPixels(data, W, W, { mask, width: 10, height: 10 }, "#1c1c1c")).toBe(true);
    const at = (x: number, y: number) => [...data.slice((y * W + x) * 4, (y * W + x) * 4 + 3)];
    const lum = (x: number, y: number) => at(x, y).reduce((a, b) => a + b, 0);
    expect(lum(20, 10)).toBeLessThan(150); // the unsure middle of the hair is dyed too
    expect(lum(9, 5)).toBeLessThan(150); // and its edge
    expect(lum(20, 9)).toBeLessThan(lum(20, 10)); // the darker strand stays darker
    expect(at(20, 20)).toEqual([230, 190, 160]); // skin: untouched
    expect(at(4, 6)).toEqual([240, 240, 240]); // background next to the hair: untouched
    expect(at(2, 38)).toEqual([90, 200, 120]); // the same green far away: untouched
    for (let i = 0; i < W * W; i++) {
      // Dyeing black never makes anything light: every changed pixel is dark.
      const [r, g, b] = [...data.slice(i * 4, i * 4 + 3)];
      const before = color(i % W, Math.floor(i / W));
      if (r !== before[0] || g !== before[1] || b !== before[2]) expect(Math.max(r, g, b)).toBeLessThan(110);
    }
    expect(recolorPixels(new Uint8ClampedArray(400), 10, 10, { mask: new Float32Array(100), width: 10, height: 10 }, "#1c1c1c")).toBe(false);
    expect([...resizeMask(new Float32Array([0, 1]), 2, 1, 4, 1)]).toEqual([0, 0.25, 0.75, 1]);
  });

  it("scores the part against its rivals so it does not spill onto them", () => {
    // Two pixels, three prompts (hair, face, background): hair wins the first pixel, face the second.
    const logits = new Float32Array([3, -1, /* face */ 0, 4, /* background */ -2, -2]);
    const share = targetShare(logits, 3, 2);
    expect(share[0]).toBeGreaterThan(0.9);
    expect(share[1]).toBeLessThan(0.05);
  });

  it("lists only the operations that change the image", () => {
    expect(operationsOf(DEFAULT_SETTINGS)).toEqual([]);
    expect(operationsOf({ ...DEFAULT_SETTINGS, sepia: true, text: "Hi" })).toEqual(["sepia", "text"]);
  });
});
