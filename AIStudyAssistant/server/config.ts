import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

export interface AppConfig {
  port: number;
  sessionSecret: string;
  dbDriver: "memory" | "mysql";
  mysqlUrl: string;
  anthropicModel: string;
  aiEnabled: boolean;
  webSearchEnabled: boolean;
  storageDir: string;
  maxUploadBytes: number;
  maxPromptLength: number;
  production: boolean;
  seedDemo: boolean;
  rootDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === "production";
  const sessionSecret = env.SESSION_SECRET ?? "";
  if (production && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
  return {
    port: Number(env.PORT ?? 3001),
    sessionSecret: sessionSecret || "dev-only-secret-change-me-dev-only-secret",
    dbDriver: env.DB_DRIVER === "mysql" ? "mysql" : "memory",
    mysqlUrl: env.MYSQL_URL ?? "mysql://root@localhost:3306/ai_study_assistant",
    anthropicModel: env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
    aiEnabled: Boolean(env.ANTHROPIC_API_KEY),
    webSearchEnabled: env.WEB_SEARCH !== "off",
    storageDir: path.resolve(root, env.STORAGE_DIR ?? "storage"),
    maxUploadBytes: 5 * 1024 * 1024,
    maxPromptLength: 4000,
    production,
    seedDemo: env.SEED_DEMO !== "off",
    rootDir: root,
  };
}
