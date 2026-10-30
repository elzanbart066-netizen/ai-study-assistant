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

/** Controls for the in-browser AI model; the static build registers it at startup. */
export interface LocalModelControl {
  /** Model name and license shown to the student. */
  readonly label: string;
  /** False when the browser has no WebGPU, so the model cannot run here. */
  supported(): boolean;
  enabled(): boolean;
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
