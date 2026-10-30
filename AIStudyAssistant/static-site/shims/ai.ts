// Browser version of the AI integration: Claude is called straight from the
// page with the student's own key (see src/services/aiKey.ts).
import Anthropic from "@anthropic-ai/sdk";
import {
  type AIProvider,
  AnthropicProvider,
  type CompletionRequest,
  type CompletionResult,
  DisabledAIProvider,
  domainOf,
} from "../../server/integrations/ai.js";
import { readApiKey } from "../../src/services/aiKey.js";

export { type AIProvider, AnthropicProvider, type CompletionRequest, type CompletionResult, DisabledAIProvider, domainOf };

const MODEL = "claude-opus-5-5";

export class BrowserAIProvider implements AIProvider {
  get available() {
    return readApiKey() !== "";
  }

  complete(request: CompletionRequest): Promise<CompletionResult> {
    const client = new Anthropic({ apiKey: readApiKey(), dangerouslyAllowBrowser: true });
    return new AnthropicProvider(MODEL, client).complete(request);
  }
}
