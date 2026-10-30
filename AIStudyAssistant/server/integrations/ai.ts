import Anthropic from "@anthropic-ai/sdk";
import type { SourceLink } from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export interface CompletionRequest {
  system: string;
  prompt: string;
  webSearch: boolean;
  /** The question may be grounded in encyclopedia articles (used by the on-device model). */
  reference?: boolean;
  /** Longer answers allowed (code); only the on-device model needs the hint. */
  maxTokens?: number;
  requestId?: string;
}

export interface CompletionResult {
  text: string;
  /** Only sources the model actually cited in its answer. */
  citations: SourceLink[];
  usedWebSearch: boolean;
}

/** Contract for the language-model integration; the provider is swappable. */
export interface AIProvider {
  readonly available: boolean;
  /** True for the small keyless model in the browser, which needs more help than Claude. */
  readonly onDevice?: boolean;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export class DisabledAIProvider implements AIProvider {
  readonly available = false;
  complete(): Promise<CompletionResult> {
    return Promise.reject(new AppError("AI_UNAVAILABLE", "AI provider is not configured"));
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const MAX_PAUSE_CONTINUATIONS = 3;

/** Claude via the official Anthropic SDK. The API key stays on the server. */
export class AnthropicProvider implements AIProvider {
  readonly available = true;
  private client: Anthropic;

  constructor(private model: string, client?: Anthropic) {
    this.client = client ?? new Anthropic();
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: request.prompt }];
    const tools: Anthropic.Beta.BetaToolUnion[] = request.webSearch
      ? [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]
      : [];
    const textParts: string[] = [];
    const citations = new Map<string, SourceLink>();
    let usedWebSearch = false;

    try {
      for (let turn = 0; turn <= MAX_PAUSE_CONTINUATIONS; turn++) {
        const response = await this.client.beta.messages.create({
          model: this.model,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: request.system,
          messages,
          ...(tools.length > 0 ? { tools } : {}),
        });

        if (response.stop_reason === "refusal") {
          throw new AppError("AI_UNAVAILABLE", "refusal");
        }
        for (const block of response.content) {
          if (block.type === "server_tool_use") {
            usedWebSearch = true;
          }
          if (block.type === "text") {
            textParts.push(block.text);
            for (const c of block.citations ?? []) {
              if (c.type === "web_search_result_location" && !citations.has(c.url)) {
                citations.set(c.url, { title: c.title ?? domainOf(c.url), url: c.url, domain: domainOf(c.url) });
              }
            }
          }
        }
        if (response.stop_reason !== "pause_turn") {
          break;
        }
        // A long web search can pause the turn; send the partial answer back to continue it.
        messages.push({ role: "assistant", content: response.content });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      const status = error instanceof Anthropic.APIError ? error.status : undefined;
      logger.error("AI request failed", {
        module: "integrations.ai",
        requestId: request.requestId,
        code: status ? `HTTP_${status}` : "NETWORK",
      });
      throw new AppError("AI_UNAVAILABLE", "AI request failed");
    }

    return { text: textParts.join(""), citations: [...citations.values()], usedWebSearch };
  }
}
