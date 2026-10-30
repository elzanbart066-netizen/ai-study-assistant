// The static build (GitHub Pages) has no server, so a student who wants full
// AI answers stores their own Claude API key. It stays in this browser only.

export const STATIC_SITE = import.meta.env.VITE_STATIC_SITE === "1";

export type KeyKind = "claude" | "gemini";

// A free Google Gemini key (aistudio.google.com) is the no-cost way to a strong model.
const STORAGE_KEYS: Record<KeyKind, string> = {
  claude: "ai-study-assistant.anthropic-key",
  gemini: "ai-study-assistant.gemini-key",
};

export function readApiKey(kind: KeyKind = "claude"): string {
  try {
    return localStorage.getItem(STORAGE_KEYS[kind]) ?? "";
  } catch {
    return "";
  }
}

export function writeApiKey(value: string, kind: KeyKind = "claude") {
  try {
    if (value) localStorage.setItem(STORAGE_KEYS[kind], value);
    else localStorage.removeItem(STORAGE_KEYS[kind]);
  } catch {
    // Storage blocked (private mode): the key lasts only until the page closes.
  }
}

/** True when the student saved a key for a hosted AI (Claude or Gemini). */
export const hasHostedKey = () => readApiKey("claude") !== "" || readApiKey("gemini") !== "";

/** Controls for the in-browser AI model; the static build registers it at startup. */
export interface LocalModelControl {
  /** Model name and license shown to the student. */
  readonly label: string;
  /** False when the browser has no WebGPU, so the model cannot run here. */
  supported(): boolean;
  enabled(): boolean;
  /** True once the model is loaded and answering. */
  ready(): boolean;
  /** Turns the model on (and downloads it the first time) or off. */
  setEnabled(on: boolean): void;
  /** Loads the model, reporting progress from 0 to 1; resolves when it is ready. */
  load(onProgress?: (fraction: number) => void): Promise<void>;
}

let localModel: LocalModelControl | null = null;

export function registerLocalModel(control: LocalModelControl) {
  localModel = control;
}

export function getLocalModel(): LocalModelControl | null {
  return localModel;
}
