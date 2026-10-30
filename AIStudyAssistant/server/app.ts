import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import type { AppConfig } from "./config.js";
import { type AIProvider, AnthropicProvider, DisabledAIProvider } from "./integrations/ai.js";
import { type SearchProvider, WikipediaSearch } from "./integrations/wikipedia.js";
import { AppError } from "./lib/errors.js";
import { FileStorage } from "./lib/storage.js";
import { errorHandler, requestId, sameOrigin, securityHeaders, sessionLoader } from "./middleware/index.js";
import { MemoryStore } from "./repositories/memoryStore.js";
import { MySqlStore } from "./repositories/mysqlStore.js";
import type { DataStore } from "./repositories/types.js";
import { apiRouter } from "./routes/index.js";
import { AssistantService } from "./services/assistantService.js";
import { AuthService } from "./services/authService.js";
import { HistoryService } from "./services/historyService.js";
import { MediaService } from "./services/mediaService.js";
import { SearchService } from "./services/searchService.js";

export interface AppDeps {
  store?: DataStore;
  ai?: AIProvider;
  searchProvider?: SearchProvider;
}

export async function createStore(config: AppConfig): Promise<DataStore> {
  return config.dbDriver === "mysql" ? MySqlStore.connect(config.mysqlUrl, config.rootDir) : new MemoryStore();
}

export async function createApp(config: AppConfig, deps: AppDeps = {}) {
  const store = deps.store ?? (await createStore(config));
  const ai = deps.ai ?? (config.aiEnabled ? new AnthropicProvider(config.anthropicModel) : new DisabledAIProvider());
  const search = new SearchService(deps.searchProvider ?? new WikipediaSearch(), config.webSearchEnabled);
  const storage = new FileStorage(config.storageDir);

  const auth = new AuthService(store);
  const history = new HistoryService(store, storage);
  const assistant = new AssistantService(ai, search);
  const media = new MediaService(store, storage, history, ai, search);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(securityHeaders);
  // Images are sent as base64 data URLs, two per request (original + edited).
  app.use(express.json({ limit: Math.ceil(config.maxUploadBytes * 2.8) }));
  app.use(sessionLoader(auth, config.sessionSecret));
  app.use("/api", sameOrigin, apiRouter(config, { auth, assistant, history, media }));
  app.use("/api", (_req, _res, next) => next(new AppError("NOT_FOUND", "route")));

  const dist = path.join(config.rootDir, "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  app.use(errorHandler);
  return { app, store, services: { auth, history, assistant, media } };
}
