// Browser version of the AI integration. With the student's own key, Claude or
// Google Gemini (free key) is called straight from the page (see
// src/services/aiKey.ts); without one, a small model can run on the device,
// grounded in Wikipedia articles.
import Anthropic from "@anthropic-ai/sdk";
import {
  type AIProvider,
  AnthropicProvider,
  type CompletionRequest,
  type CompletionResult,
  DisabledAIProvider,
  domainOf,
} from "../../server/integrations/ai.js";
import { AppError } from "../../server/lib/errors.js";
import type { SearchService } from "../../server/services/searchService.js";
import type { Language } from "../../src/models/index.js";
import { hasHostedKey, readApiKey } from "../../src/services/aiKey.js";
import { GeminiProvider } from "../../server/integrations/gemini.js";
import { completeLocally, localModelReady } from "../localModel.js";

export { type AIProvider, AnthropicProvider, type CompletionRequest, type CompletionResult, DisabledAIProvider, domainOf };

const MODEL = "claude-opus-5-5";
const CONTEXT_CHARS = 1500;

export class BrowserAIProvider implements AIProvider {
  constructor(
    private search?: SearchService,
    private language: () => Language = () => "kk",
  ) {}

  get available() {
    return hasHostedKey() || localModelReady();
  }

  get onDevice() {
    return !hasHostedKey();
  }

  complete(request: CompletionRequest): Promise<CompletionResult> {
    if (readApiKey()) {
      const client = new Anthropic({ apiKey: readApiKey(), dangerouslyAllowBrowser: true });
      return new AnthropicProvider(MODEL, client).complete(request);
    }
    if (readApiKey("gemini")) return new GeminiProvider(() => readApiKey("gemini")).complete(request);
    return this.completeOnDevice(request);
  }

  private async completeOnDevice(request: CompletionRequest): Promise<CompletionResult> {
    // The small model knows less than Claude, so questions that need facts get
    // Wikipedia extracts as reference material, cited as the answer's sources.
    const hits =
      (request.webSearch || request.reference) && this.search
        ? await this.search.find(request.prompt, this.language(), 3, 8_000).catch(() => [])
        : [];
    const reference = hits
      .map((h, i) => `[${i + 1}] ${h.title} (${h.url})\n${h.extract.slice(0, CONTEXT_CHARS)}`)
      .join("\n\n");
    const prompt = reference
      ? `${request.prompt}\n\nReference material from Wikipedia (CC BY-SA 4.0). Base the answer on it:\n\n${reference}`
      : request.prompt;
    try {
      const text = await completeLocally(request.system, prompt, request.maxTokens);
      return {
        text,
        citations: hits.map(({ title, url, domain }) => ({ title, url, domain })),
        usedWebSearch: hits.length > 0,
      };
    } catch {
      throw new AppError("AI_UNAVAILABLE", "local model failed");
    }
  }
}
