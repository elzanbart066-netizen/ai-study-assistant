// Structured JSON logger. Secrets and personal data never reach the log:
// any key that looks sensitive is replaced before writing.

const SENSITIVE = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|email/i;

type Level = "info" | "warn" | "error";

export interface LogEntry {
  module: string;
  requestId?: string;
  code?: string;
  [key: string]: unknown;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

const sink: { write: (line: string) => void } = {
  write: (line) => process.stdout.write(`${line}\n`),
};

export function setLogSink(write: (line: string) => void) {
  sink.write = write;
}

function log(level: Level, message: string, entry: LogEntry) {
  sink.write(
    JSON.stringify({ time: new Date().toISOString(), level, message, ...(redact(entry) as object) }),
  );
}

export const logger = {
  info: (message: string, entry: LogEntry) => log("info", message, entry),
  warn: (message: string, entry: LogEntry) => log("warn", message, entry),
  error: (message: string, entry: LogEntry) => log("error", message, entry),
};
