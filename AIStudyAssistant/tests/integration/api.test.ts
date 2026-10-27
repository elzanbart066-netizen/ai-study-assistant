import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { loadConfig } from "../../server/config.js";
import type { AIProvider, CompletionRequest } from "../../server/integrations/ai.js";
import type { SearchProvider } from "../../server/integrations/wikipedia.js";
import { AppError } from "../../server/lib/errors.js";
import { setLogSink } from "../../server/lib/logger.js";
import { MemoryStore } from "../../server/repositories/memoryStore.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const pngUrl = `data:image/png;base64,${PNG.toString("base64")}`;

const search: SearchProvider & { fail: boolean; empty: boolean } = {
  fail: false,
  empty: false,
  async search(query, language) {
    if (this.fail) throw new AppError("SEARCH_UNAVAILABLE");
    if (this.empty) return [];
    return [
      {
        title: `Article about ${query}`,
        url: `https://${language}.wikipedia.org/wiki/Test`,
        domain: `${language}.wikipedia.org`,
        extract: "First sentence about the topic. Second sentence with more detail. Third sentence. Fourth sentence.",
      },
    ];
  },
};

class FakeAI implements AIProvider {
  available = true;
  calls: CompletionRequest[] = [];
  down = false;
  async complete(req: CompletionRequest) {
    this.calls.push(req);
    if (this.down) throw new AppError("AI_UNAVAILABLE");
    if (req.system.includes("## SECTION")) {
      return { text: "## SECTION: Intro\nPara one.\nPara two.\n## SECTION: Details\nMore.", citations: [], usedWebSearch: false };
    }
    if (req.system.includes("## CODE")) {
      return { text: "## CODE\n```python\nprint('hi')\n```\n## EXPLANATION\nPrints hi.\n## INPUT\n-\n## OUTPUT\nhi", citations: [], usedWebSearch: false };
    }
    if (req.system.includes("## GIVEN")) {
      return { text: "## GIVEN\nTwo trains\n## METHOD\nd = v·t\n## STEPS\n1. a\n2. b\n## ANSWER\n3 h\n## CHECK\nok", citations: [], usedWebSearch: false };
    }
    return {
      text: "## SUMMARY\nShort answer.\n## EXPLANATION\nLonger.\n## EXAMPLE\nAn example.\n## UNCERTAINTY\n-",
      citations: req.webSearch ? [{ title: "Source", url: "https://example.edu/a", domain: "example.edu" }] : [],
      usedWebSearch: req.webSearch,
    };
  }
}

let storageDir: string;
const logs: string[] = [];

async function makeApp(ai?: AIProvider) {
  const config = { ...loadConfig({ NODE_ENV: "test" }), storageDir, webSearchEnabled: true };
  return (await createApp(config, { store: new MemoryStore(), searchProvider: search, ai })).app;
}

async function signUp(app: Awaited<ReturnType<typeof makeApp>>, email = "student@study.kz") {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/register")
    .send({ name: "Test Student", email, password: "password123", passwordConfirm: "password123", language: "en" });
  expect(res.status).toBe(201);
  return agent;
}

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), "asa-test-"));
  setLogSink((line) => logs.push(line));
});

afterAll(async () => {
  await rm(storageDir, { recursive: true, force: true });
});

describe("auth", () => {
  it("registers, rejects duplicates and bad input, logs in and out", async () => {
    const app = await makeApp();
    const agent = await signUp(app);
    expect((await agent.get("/api/auth/me")).body.user.email).toBe("student@study.kz");

    const dup = await request(app)
      .post("/api/auth/register")
      .send({ name: "Other", email: "STUDENT@study.kz", password: "password123", passwordConfirm: "password123" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("EMAIL_TAKEN");

    const empty = await request(app).post("/api/auth/register").send({ name: "", email: "a@b.kz", password: "password123" });
    expect(empty.body.error).toMatchObject({ code: "VALIDATION", field: "name" });

    const wrong = await request(app).post("/api/auth/login").send({ email: "student@study.kz", password: "nope-nope" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");

    await agent.post("/api/auth/logout");
    expect((await agent.get("/api/auth/me")).body.user).toBeNull();
    expect((await agent.get("/api/history")).status).toBe(401);
  });

  it("never stores or logs the plain password", async () => {
    const app = await makeApp();
    await signUp(app, "secret@study.kz");
    expect(logs.join("\n")).not.toContain("password123");
  });

  it("rejects cross-site state-changing requests", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: "a@b.kz", password: "password123" });
    expect(res.status).toBe(403);
  });
});

describe("profile and language", () => {
  it("switches between the three languages and rejects others", async () => {
    const app = await makeApp();
    const agent = await signUp(app);
    expect((await agent.put("/api/profile/language").send({ language: "ru" })).body.user.language).toBe("ru");
    expect((await agent.put("/api/profile/language").send({ language: "de" })).status).toBe(400);
    expect((await agent.put("/api/profile").send({ name: "New Name" })).body.user.name).toBe("New Name");
  });

  it("does not save history when the student turns it off", async () => {
    const app = await makeApp();
    const agent = await signUp(app);
    await agent.put("/api/profile").send({ saveHistory: false });
    const res = await agent.post("/api/assistant/solve").send({ prompt: "1 + 1" });
    expect(res.body.messageId).toBeUndefined();
    expect((await agent.get("/api/history")).body.total).toBe(0);
  });
});

describe("assistant offline (no AI key)", () => {
  it("rejects an empty question", async () => {
    const agent = await signUp(await makeApp());
    const res = await agent.post("/api/assistant/ask").send({ prompt: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION", reason: "promptEmpty", field: "prompt" });
  });

  it("answers from search results and stores the sources it used", async () => {
    const agent = await signUp(await makeApp());
    const res = await agent.post("/api/assistant/ask").send({ prompt: "Photosynthesis", language: "en" });
    expect(res.status).toBe(200);
    expect(res.body.result.provider).toBe("offline");
    expect(res.body.result.sources[0].url).toBe("https://en.wikipedia.org/wiki/Test");
    expect(res.body.result.license).toContain("CC BY-SA");
    const detail = await agent.get(`/api/history/${res.body.messageId}`);
    expect(detail.body.sources).toHaveLength(1);
  });

  it("reports when search is down or finds nothing", async () => {
    const agent = await signUp(await makeApp());
    search.fail = true;
    const down = await agent.post("/api/assistant/ask").send({ prompt: "Anything" });
    search.fail = false;
    expect(down.status).toBe(503);
    expect(down.body.error.code).toBe("SEARCH_UNAVAILABLE");
    expect(down.body.error.requestId).toBeTruthy();
    search.empty = true;
    const none = await agent.post("/api/assistant/ask").send({ prompt: "Anything" });
    search.empty = false;
    expect(none.body.error.code).toBe("NO_SOURCES");
  });

  it("solves equations locally and explains when the AI is needed", async () => {
    const agent = await signUp(await makeApp());
    const ok = await agent.post("/api/assistant/solve").send({ prompt: "2x + 5 = 13", language: "kk" });
    expect(ok.body.result.answer).toBe("x = 4");
    const word = await agent.post("/api/assistant/solve").send({ prompt: "Two trains leave a station" });
    expect(word.status).toBe(503);
    expect(word.body.error.reason).toBe("solveOffline");
  });

  it("returns template code and validates the programming language", async () => {
    const agent = await signUp(await makeApp());
    const ok = await agent.post("/api/assistant/code").send({ prompt: "fibonacci", codeLanguage: "cpp" });
    expect(ok.body.result.code).toContain("#include <iostream>");
    const bad = await agent.post("/api/assistant/code").send({ prompt: "fibonacci", codeLanguage: "cobol" });
    expect(bad.status).toBe(400);
  });
});

describe("assistant with an AI provider", () => {
  it("passes the language and web-search flag, and returns only cited sources", async () => {
    const ai = new FakeAI();
    const agent = await signUp(await makeApp(ai));
    const res = await agent.post("/api/assistant/ask").send({ prompt: "What is DNA?", webSearch: true, language: "ru" });
    expect(res.body.result).toMatchObject({ summary: "Short answer.", example: "An example.", provider: "ai" });
    expect(res.body.result.sources).toEqual([{ title: "Source", url: "https://example.edu/a", domain: "example.edu" }]);
    expect(ai.calls[0].webSearch).toBe(true);
    expect(ai.calls[0].system).toContain("Russian");
    expect(ai.calls[0].system).toContain("Do not ask the student follow-up");
  });

  it("enables web search automatically for time-sensitive questions", async () => {
    const ai = new FakeAI();
    const agent = await signUp(await makeApp(ai));
    await agent.post("/api/assistant/ask").send({ prompt: "Latest news in physics", webSearch: false });
    expect(ai.calls[0].webSearch).toBe(true);
  });

  it("uses the local solver first and the AI for word problems", async () => {
    const ai = new FakeAI();
    const agent = await signUp(await makeApp(ai));
    await agent.post("/api/assistant/solve").send({ prompt: "3x = 9" });
    expect(ai.calls).toHaveLength(0);
    const word = await agent.post("/api/assistant/solve").send({ prompt: "Two trains leave a station" });
    expect(word.body.result).toMatchObject({ answer: "3 h", steps: ["a", "b"], provider: "ai" });
  });

  it("parses generated code and shows a retry-able error when the AI is down", async () => {
    const ai = new FakeAI();
    const agent = await signUp(await makeApp(ai));
    const ok = await agent.post("/api/assistant/code").send({ prompt: "say hi", codeLanguage: "python" });
    expect(ok.body.result).toMatchObject({ code: "print('hi')", sampleInput: "", sampleOutput: "hi" });
    ai.down = true;
    const down = await agent.post("/api/assistant/ask").send({ prompt: "Hello" });
    expect(down.status).toBe(503);
    expect(down.body.error.code).toBe("AI_UNAVAILABLE");
  });
});

describe("files", () => {
  it.each(["docx", "pdf", "pptx", "txt"] as const)("creates and downloads a %s file", async (format) => {
    const agent = await signUp(await makeApp(new FakeAI()));
    const res = await agent.post("/api/files/create").send({ title: "Solar system", instruction: "Planets", format });
    expect(res.status).toBe(201);
    expect(res.body.result.sections[0].heading).toBe("Intro");
    const file = await agent
      .get(`/api/assets/${res.body.result.assetId}`)
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(file.status).toBe(200);
    expect(file.headers["content-disposition"]).toContain(`Solar%20system.${format}`);
    const magic = { docx: "PK", pptx: "PK", pdf: "%PDF", txt: "Solar system" }[format];
    expect((file.body as Buffer).subarray(0, magic.length).toString()).toBe(magic);
  });

  it("rejects an unsupported format and an empty title", async () => {
    const agent = await signUp(await makeApp(new FakeAI()));
    const bad = await agent.post("/api/files/create").send({ title: "A", instruction: "B", format: "exe" });
    expect(bad.body.error.code).toBe("FILE_INVALID");
    const noTitle = await agent.post("/api/files/create").send({ title: "", instruction: "B", format: "txt" });
    expect(noTitle.body.error.field).toBe("title");
  });
});

describe("images", () => {
  it("stores the original and the edited image for comparison", async () => {
    const agent = await signUp(await makeApp());
    const res = await agent
      .post("/api/images/edit")
      .send({ original: pngUrl, edited: pngUrl, operations: ["grayscale", "bogus"], instruction: "make it grey" });
    expect(res.status).toBe(201);
    expect(res.body.result.operations).toEqual(["grayscale"]);
    const original = await agent.get(`/api/assets/${res.body.result.originalAssetId}?inline=1`);
    expect(original.headers["content-type"]).toBe("image/png");
    expect(original.headers["content-disposition"]).toMatch(/^inline/);
  });

  it("rejects fake images, unsupported types and oversized files", async () => {
    const agent = await signUp(await makeApp());
    const fake = `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`;
    expect((await agent.post("/api/images/edit").send({ original: fake, edited: pngUrl, operations: ["blur"] })).body.error.code).toBe(
      "IMAGE_INVALID",
    );
    expect(
      (await agent.post("/api/images/edit").send({ original: "data:image/gif;base64,R0lG", edited: pngUrl, operations: ["blur"] })).body
        .error.code,
    ).toBe("IMAGE_INVALID");
    const big = `data:image/png;base64,${Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]).toString("base64")}`;
    const res = await agent.post("/api/images/edit").send({ original: big, edited: pngUrl, operations: ["blur"] });
    expect(res.status).toBe(400);
    expect(["IMAGE_INVALID", "FILE_INVALID"]).toContain(res.body.error.code);
  });
});

describe("history", () => {
  it("searches, filters, sorts, saves and deletes the student's own records", async () => {
    const agent = await signUp(await makeApp());
    for (const prompt of ["2x = 4", "3x = 9", "1 + 1"]) await agent.post("/api/assistant/solve").send({ prompt });
    await agent.post("/api/assistant/code").send({ prompt: "factorial", codeLanguage: "python" });

    expect((await agent.get("/api/history")).body.total).toBe(4);
    expect((await agent.get("/api/history?type=code")).body.total).toBe(1);
    expect((await agent.get("/api/history?q=3x")).body.items[0].prompt).toBe("3x = 9");
    const oldest = await agent.get("/api/history?sort=oldest&limit=1");
    expect(oldest.body.items[0].prompt).toBe("2x = 4");
    expect((await agent.get("/api/history?type=video")).status).toBe(400);

    const id = oldest.body.items[0].id;
    await agent.put(`/api/history/${id}/saved`).send({ saved: true });
    expect((await agent.get("/api/history?saved=1")).body.total).toBe(1);

    const stats = await agent.get("/api/history/stats");
    expect(stats.body).toMatchObject({ total: 4, savedCount: 1, byType: { solve: 3, code: 1 } });

    expect((await agent.delete(`/api/history/${id}`)).status).toBe(204);
    expect((await agent.get(`/api/history/${id}`)).status).toBe(404);
  });

  it("does not let one student open or delete another student's data", async () => {
    const app = await makeApp(new FakeAI());
    const alice = await signUp(app, "alice@study.kz");
    const bob = await signUp(app, "bob@study.kz");
    const solved = await alice.post("/api/assistant/solve").send({ prompt: "2x = 4" });
    const file = await alice.post("/api/files/create").send({ title: "Notes", instruction: "x", format: "txt" });

    expect((await bob.get(`/api/history/${solved.body.messageId}`)).status).toBe(403);
    expect((await bob.delete(`/api/history/${solved.body.messageId}`)).status).toBe(403);
    expect((await bob.get(`/api/assets/${file.body.result.assetId}`)).status).toBe(403);
    expect((await bob.get("/api/history")).body.total).toBe(0);
    expect(logs.some((l) => l.includes("access denied"))).toBe(true);
  });
});

describe("data layer", () => {
  it("does not leave a partial record when saving fails", async () => {
    const store = new MemoryStore();
    await expect(
      store.saveMessageWithSources(
        {
          id: "m1",
          conversationId: "missing",
          userId: "u1",
          type: "ask",
          prompt: "q",
          answer: "{}",
          status: "done",
          language: "kk",
          createdAt: new Date().toISOString(),
        },
        [{ id: "s1", messageId: "m1", title: "t", url: "https://a.b", domain: "a.b", retrievedAt: "" }],
      ),
    ).rejects.toThrow();
    expect(await store.findMessage("m1")).toBeNull();
    expect(await store.listSources("m1")).toEqual([]);
  });

  it("returns a request id instead of crashing on unknown routes", async () => {
    const res = await request(await makeApp()).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["x-request-id"]).toBe(res.body.error.requestId);
  });
});
