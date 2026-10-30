// The static build (GitHub Pages) has no server, so a student who wants full
// AI answers stores their own Claude API key. It stays in this browser only.

export const STATIC_SITE = import.meta.env.VITE_STATIC_SITE === "1";

const STORAGE_KEY = "ai-study-assistant.anthropic-key";

export function readApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeApiKey(value: string) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): the key lasts only until the page closes.
  }
}
