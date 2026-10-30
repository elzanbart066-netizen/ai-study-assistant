import type { SourceLink } from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import { domainOf, type AIProvider, type CompletionRequest, type CompletionResult } from "./ai.js";

// Google Gemini through its REST API. Students can get a free key at
// aistudio.google.com, so the static site can offer a strong model at no cost.
// The key is the student's own and is sent only to Google.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
// The alias follows Google's current Flash model; the fixed name is the fallback.
const MODELS = ["gemini-flash-latest", "gemini-2.5-flash"];

interface GeminiPart {
  text?: string;
  thought?: boolean;
}
interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
  }[];
}

export class GeminiProvider implements AIProvider {
  readonly available = true;

  constructor(
    private apiKey: () => string,
    private fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    // Web search (Google Search grounding) can be missing on a free key; then answer without it.
    const attempts = request.webSearch ? [true, false] : [false];
    let lastStatus = 0;
    for (const model of MODELS) {
      for (const search of attempts) {
        const response = await this.call(model, request, search).catch(() => null);
        if (!response) throw new AppError("AI_UNAVAILABLE", "geminiFailed");
        if (response.ok) return parse((await response.json()) as GeminiResponse, search);
        lastStatus = response.status;
        // A wrong key or an exhausted free quota will not get better with another try.
        if (response.status === 401 || response.status === 403) throw new AppError("AI_UNAVAILABLE", "geminiKey");
        if (response.status === 429) throw new AppError("AI_UNAVAILABLE", "geminiQuota");
        if (response.status === 404) break; // try the next model name
      }
    }
    throw new AppError("AI_UNAVAILABLE", lastStatus === 400 ? "geminiKey" : "geminiFailed");
  }

  private call(model: string, request: CompletionRequest, search: boolean) {
    return this.fetcher(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: { maxOutputTokens: 16000, temperature: 0.4 },
        ...(search ? { tools: [{ google_search: {} }] } : {}),
      }),
    });
  }
}

function parse(data: GeminiResponse, search: boolean): CompletionResult {
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) throw new AppError("AI_UNAVAILABLE", candidate?.finishReason === "SAFETY" ? "refusal" : "geminiFailed");
  const citations = new Map<string, SourceLink>();
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    const url = chunk.web?.uri;
    if (!url || citations.has(url)) continue;
    const title = chunk.web?.title ?? url;
    citations.set(url, { title, url, domain: chunk.web?.title?.includes(".") ? chunk.web.title : domainOf(url) });
  }
  return { text, citations: [...citations.values()], usedWebSearch: search && citations.size > 0 };
}
