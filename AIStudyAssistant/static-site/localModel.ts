// Free AI without a key: a small open model (Qwen3 1.7B, Apache-2.0) runs on
// the student's own device through WebGPU (WebLLM). It is downloaded once
// (about 1 GB) and then kept in the browser cache.
import type { InitProgressReport, MLCEngineInterface } from "@mlc-ai/web-llm";
import type { LocalModelControl } from "../src/services/aiKey.js";

const MODEL_F16 = "Qwen3-1.7B-q4f16_1-MLC";
const MODEL_F32 = "Qwen3-1.7B-q4f32_1-MLC";
const FLAG = "ai-study-assistant.local-model";

// Answers longer than this are cut short, so a slow device never keeps the student waiting.
const ANSWER_TIME_LIMIT_MS = 60_000;

let engine: Promise<MLCEngineInterface> | null = null;
let loaded: MLCEngineInterface | null = null;
const listeners = new Set<(fraction: number) => void>();

function supported() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

function enabled() {
  try {
    return localStorage.getItem(FLAG) === "on";
  } catch {
    return false;
  }
}

function setEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG, "on");
    else localStorage.removeItem(FLAG);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  if (!on && engine) {
    void engine.then((e) => e.unload()).catch(() => undefined);
    engine = null;
    loaded = null;
  }
}

async function pickModel(): Promise<string> {
  const gpu = (navigator as unknown as { gpu: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error("no WebGPU adapter");
  return adapter.features.has("shader-f16") ? MODEL_F16 : MODEL_F32;
}

function load(onProgress?: (fraction: number) => void): Promise<void> {
  if (onProgress) listeners.add(onProgress);
  if (!engine) {
    engine = (async () => {
      const [{ CreateMLCEngine }, model] = await Promise.all([import("@mlc-ai/web-llm"), pickModel()]);
      const created = await CreateMLCEngine(model, {
        initProgressCallback: (report: InitProgressReport) => {
          for (const listener of listeners) listener(report.progress);
        },
      });
      loaded = created;
      return created;
    })();
    engine.catch(() => {
      engine = null;
      loaded = null;
    });
  }
  return engine.then(
    () => {
      if (onProgress) listeners.delete(onProgress);
    },
    (error: unknown) => {
      if (onProgress) listeners.delete(onProgress);
      throw error;
    },
  );
}

/** Starts loading the model in the background when the student turned it on earlier. */
export function preloadLocalModel() {
  if (supported() && enabled()) void load().catch(() => undefined);
}

/** Answers one request with the loaded local model; fails if it is still loading or too slow. */
export async function completeLocally(system: string, prompt: string): Promise<string> {
  const e = loaded;
  if (!e) throw new Error("local model is not loaded yet");
  const timer = setTimeout(() => e.interruptGenerate(), ANSWER_TIME_LIMIT_MS);
  try {
    const reply = await e.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 800,
      extra_body: { enable_thinking: false },
    });
    const choice = reply.choices[0];
    const text = (choice?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text || choice?.finish_reason === "abort") throw new Error("no answer in time");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export const localModel: LocalModelControl = {
  label: "Qwen3 1.7B (Apache-2.0)",
  supported,
  enabled,
  ready: () => loaded !== null,
  setEnabled,
  load,
};

/** True once the model is in memory; until then questions get the Wikipedia answer. */
export const localModelReady = () => supported() && enabled() && loaded !== null;
