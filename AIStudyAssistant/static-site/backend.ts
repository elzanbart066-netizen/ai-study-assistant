// In-browser stand-in for the Express API: the same services and validation,
// called directly instead of over HTTP. Data lives in memory for this tab.
import { DEMO_EMAIL, seedDemo } from "../database/demo.js";
import { AppError } from "../server/lib/errors.js";
import {
  validateCodeLanguage,
  validateFileFormat,
  validateLanguage,
  validatePrompt,
  validateTitle,
} from "../server/lib/validation.js";
import type { FileStorage as ServerFileStorage } from "../server/lib/storage.js";
import { MemoryStore } from "../server/repositories/memoryStore.js";
import { AssistantService, classifyQuestion } from "../server/services/assistantService.js";
import { AuthService } from "../server/services/authService.js";
import { HistoryService } from "../server/services/historyService.js";
import { MediaService } from "../server/services/mediaService.js";
import { SearchService } from "../server/services/searchService.js";
import type { Language, PublicUser } from "../src/models/index.js";
import { WikipediaSearch } from "../server/integrations/wikipedia.js";
import { BrowserAIProvider } from "./shims/ai.js";
import { FileStorage } from "./shims/storage.js";

const MAX_PROMPT = 4000;
const MAX_UPLOAD = 5 * 1024 * 1024;

const store = new MemoryStore();
// Same public methods as the server storage, kept in memory.
const storage = new FileStorage() as unknown as ServerFileStorage;
// Browsers refuse a custom User-Agent on cross-site requests, so only the signal is passed on.
const search = new SearchService(new WikipediaSearch((url, init) => fetch(url, { signal: init?.signal })), true);
let currentLanguage: Language = "kk";
const ai = new BrowserAIProvider(search, () => currentLanguage);
const auth = new AuthService(store);
const history = new HistoryService(store, storage);
const assistant = new AssistantService(ai, search);
const media = new MediaService(store, storage, history, ai, search);

let currentUserId: string | null = null;

const ready = (async () => {
  await seedDemo(store, history);
  const demo = await store.findUserByEmail(DEMO_EMAIL);
  currentUserId = demo?.id ?? null;
})();

type Body = Record<string, unknown>;
export interface Reply {
  status: number;
  data?: unknown;
}

async function currentUser(): Promise<PublicUser | null> {
  if (!currentUserId) return null;
  return auth.getUser(currentUserId).catch(() => null);
}

export async function handle(method: string, url: string, body: Body = {}): Promise<Reply> {
  await ready;
  const parsed = new URL(url, "http://demo");
  const path = parsed.pathname;
  const query = Object.fromEntries(parsed.searchParams) as Record<string, unknown>;
  const user = await currentUser();
  const need = () => {
    if (!user) throw new AppError("UNAUTHORIZED", "login required");
    return user;
  };
  const lang = (): Language => {
    currentLanguage = body.language ? validateLanguage(body.language) : (user?.language ?? "kk");
    return currentLanguage;
  };
  const route = `${method} ${path}`;
  const historyId = path.match(/^\/history\/([^/]+)(\/saved)?$/);

  switch (route) {
    case "GET /health":
      return { status: 200, data: { ok: true, ai: ai.available, webSearch: true, db: "memory" } };
    case "POST /auth/register": {
      const created = await auth.register(body as never);
      currentUserId = created.id;
      return { status: 201, data: { user: created } };
    }
    case "POST /auth/login": {
      const found = await auth.login(body.email, body.password);
      currentUserId = found.id;
      return { status: 200, data: { user: found } };
    }
    case "POST /auth/logout":
      currentUserId = null;
      return { status: 200, data: { ok: true } };
    case "GET /auth/me":
      return { status: 200, data: { user } };
    case "GET /profile":
      return { status: 200, data: { user: need() } };
    case "PUT /profile":
      return { status: 200, data: { user: await auth.updateProfile(need().id, body) } };
    case "PUT /profile/language":
      return { status: 200, data: { user: await auth.setLanguage(need().id, body.language) } };
    case "POST /assistant/ask": {
      const u = need();
      const prompt = validatePrompt(body.prompt, MAX_PROMPT);
      const language = lang();
      const result = await assistant.ask({ prompt, language, webSearch: body.webSearch === true });
      const saved = await history.record({
        userId: u.id,
        type: "ask",
        prompt,
        answer: result,
        language,
        sources: result.sources,
        conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      });
      return { status: 200, data: { result, kind: classifyQuestion(prompt), ...saved } };
    }
    case "POST /assistant/solve": {
      const u = need();
      const prompt = validatePrompt(body.prompt, MAX_PROMPT);
      const language = lang();
      const result = await assistant.solve(prompt, language);
      const saved = await history.record({ userId: u.id, type: "solve", prompt, answer: result, language });
      return { status: 200, data: { result, ...saved } };
    }
    case "POST /assistant/code": {
      const u = need();
      const prompt = validatePrompt(body.prompt, MAX_PROMPT);
      const codeLanguage = validateCodeLanguage(body.codeLanguage);
      const language = lang();
      const result = await assistant.code(prompt, codeLanguage, language);
      const saved = await history.record({ userId: u.id, type: "code", prompt, answer: result, language });
      return { status: 200, data: { result, ...saved } };
    }
    case "POST /files/create": {
      const u = need();
      const out = await media.createFile({
        userId: u.id,
        title: validateTitle(body.title),
        instruction: validatePrompt(body.instruction, MAX_PROMPT, "instruction"),
        format: validateFileFormat(body.format),
        language: lang(),
      });
      return { status: 201, data: out };
    }
    case "POST /images/edit": {
      const u = need();
      const out = await media.saveEditedImage({
        userId: u.id,
        original: body.original,
        edited: body.edited,
        operations: body.operations,
        instruction: body.instruction,
        language: lang(),
        maxBytes: MAX_UPLOAD,
      } as never);
      return { status: 201, data: out };
    }
    case "GET /history":
      return { status: 200, data: await history.list(need().id, query) };
    case "GET /history/stats":
      return { status: 200, data: await history.stats(need().id) };
  }
  if (historyId) {
    const u = need();
    const id = decodeURIComponent(historyId[1]);
    if (historyId[2] && method === "PUT") {
      await history.setSaved(u.id, id, body.saved !== false, body.label);
      return { status: 200, data: { ok: true } };
    }
    if (!historyId[2] && method === "GET") return { status: 200, data: await history.get(u.id, id) };
    if (!historyId[2] && method === "DELETE") {
      await history.remove(u.id, id);
      return { status: 204 };
    }
  }
  throw new AppError("NOT_FOUND", "route");
}
