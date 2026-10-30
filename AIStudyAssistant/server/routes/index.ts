import { Router, type NextFunction, type Request, type Response } from "express";
import type { Language } from "../../src/models/index.js";
import type { AppConfig } from "../config.js";
import { MIME } from "../integrations/documents.js";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "../lib/security.js";
import {
  validateCodeLanguage,
  validateFileFormat,
  validateLanguage,
  validatePrompt,
  validateTitle,
} from "../lib/validation.js";
import { rateLimit, requireAuth } from "../middleware/index.js";
import type { AssistantService } from "../services/assistantService.js";
import { classifyQuestion } from "../services/assistantService.js";
import type { AuthService } from "../services/authService.js";
import type { HistoryService } from "../services/historyService.js";
import type { MediaService } from "../services/mediaService.js";

export interface Services {
  auth: AuthService;
  assistant: AssistantService;
  history: HistoryService;
  media: MediaService;
}

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

function language(req: Request): Language {
  const body = req.body as { language?: unknown } | undefined;
  return body?.language ? validateLanguage(body.language) : (req.user?.language ?? "kk");
}

export function apiRouter(config: AppConfig, s: Services): Router {
  const r = Router();
  const authLimit = rateLimit("auth", 20, 15 * 60 * 1000);
  const aiLimit = rateLimit("ai", 30, 60 * 1000);

  const setSession = (res: Response, userId: string) =>
    res.cookie(SESSION_COOKIE, createSessionToken(userId, config.sessionSecret), {
      httpOnly: true,
      sameSite: "lax",
      secure: config.production,
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    });

  r.get("/health", (_req, res) => {
    res.json({ ok: true, ai: s.assistant.aiAvailable, webSearch: config.webSearchEnabled, db: config.dbDriver });
  });

  // ---- auth ----
  r.post(
    "/auth/register",
    authLimit,
    h(async (req, res) => {
      const user = await s.auth.register(req.body ?? {});
      setSession(res, user.id);
      res.status(201).json({ user });
    }),
  );
  r.post(
    "/auth/login",
    authLimit,
    h(async (req, res) => {
      const user = await s.auth.login(req.body?.email, req.body?.password);
      setSession(res, user.id);
      res.json({ user });
    }),
  );
  r.post("/auth/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  });
  r.get("/auth/me", (req, res) => {
    res.json({ user: req.user ?? null });
  });

  // ---- profile ----
  r.get("/profile", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });
  r.put(
    "/profile",
    requireAuth,
    h(async (req, res) => {
      res.json({ user: await s.auth.updateProfile(req.user!.id, req.body ?? {}) });
    }),
  );
  r.put(
    "/profile/language",
    requireAuth,
    h(async (req, res) => {
      res.json({ user: await s.auth.setLanguage(req.user!.id, req.body?.language) });
    }),
  );

  // ---- assistant ----
  r.post(
    "/assistant/ask",
    requireAuth,
    aiLimit,
    h(async (req, res) => {
      const prompt = validatePrompt(req.body?.prompt, config.maxPromptLength);
      const lang = language(req);
      const result = await s.assistant.ask({
        prompt,
        language: lang,
        webSearch: req.body?.webSearch === true,
        requestId: req.requestId,
      });
      const saved = await s.history.record({
        userId: req.user!.id,
        type: "ask",
        prompt,
        answer: result,
        language: lang,
        sources: result.sources,
        conversationId: typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined,
      });
      res.json({ result, kind: classifyQuestion(prompt), ...saved });
    }),
  );
  r.post(
    "/assistant/solve",
    requireAuth,
    aiLimit,
    h(async (req, res) => {
      const prompt = validatePrompt(req.body?.prompt, config.maxPromptLength);
      const lang = language(req);
      const result = await s.assistant.solve(prompt, lang, req.requestId);
      const saved = await s.history.record({ userId: req.user!.id, type: "solve", prompt, answer: result, language: lang });
      res.json({ result, ...saved });
    }),
  );
  r.post(
    "/assistant/code",
    requireAuth,
    aiLimit,
    h(async (req, res) => {
      const prompt = validatePrompt(req.body?.prompt, config.maxPromptLength);
      const codeLanguage = validateCodeLanguage(req.body?.codeLanguage);
      const lang = language(req);
      const result = await s.assistant.code(prompt, codeLanguage, lang, req.requestId);
      const saved = await s.history.record({ userId: req.user!.id, type: "code", prompt, answer: result, language: lang });
      res.json({ result, ...saved });
    }),
  );

  // ---- files and images ----
  r.post(
    "/files/create",
    requireAuth,
    aiLimit,
    h(async (req, res) => {
      const out = await s.media.createFile({
        userId: req.user!.id,
        title: validateTitle(req.body?.title),
        instruction: validatePrompt(req.body?.instruction, config.maxPromptLength, "instruction"),
        format: validateFileFormat(req.body?.format),
        language: language(req),
        requestId: req.requestId,
      });
      res.status(201).json(out);
    }),
  );
  r.post(
    "/images/edit",
    requireAuth,
    h(async (req, res) => {
      const out = await s.media.saveEditedImage({
        userId: req.user!.id,
        original: req.body?.original,
        edited: req.body?.edited,
        operations: req.body?.operations,
        instruction: req.body?.instruction,
        language: language(req),
        maxBytes: config.maxUploadBytes,
      });
      res.status(201).json(out);
    }),
  );
  r.get(
    "/assets/:id",
    requireAuth,
    h(async (req, res) => {
      const { asset, data } = await s.media.readAsset(req.user!.id, String(req.params.id));
      const type = MIME[asset.format as keyof typeof MIME] ?? "application/octet-stream";
      const inline = req.query.inline === "1" && asset.kind === "image";
      res.setHeader("Content-Type", type);
      res.setHeader(
        "Content-Disposition",
        `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      );
      res.setHeader("Cache-Control", "private, max-age=0");
      res.send(data);
    }),
  );

  // ---- history ----
  r.get(
    "/history",
    requireAuth,
    h(async (req, res) => {
      res.json(await s.history.list(req.user!.id, req.query as Record<string, unknown>));
    }),
  );
  r.get(
    "/history/stats",
    requireAuth,
    h(async (req, res) => {
      res.json(await s.history.stats(req.user!.id));
    }),
  );
  r.get(
    "/history/:id",
    requireAuth,
    h(async (req, res) => {
      res.json(await s.history.get(req.user!.id, String(req.params.id)));
    }),
  );
  r.delete(
    "/history/:id",
    requireAuth,
    h(async (req, res) => {
      await s.history.remove(req.user!.id, String(req.params.id));
      res.status(204).end();
    }),
  );
  r.put(
    "/history/:id/saved",
    requireAuth,
    h(async (req, res) => {
      await s.history.setSaved(req.user!.id, String(req.params.id), req.body?.saved !== false, req.body?.label);
      res.json({ ok: true });
    }),
  );

  return r;
}
