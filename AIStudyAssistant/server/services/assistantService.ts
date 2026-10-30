import type {
  AskResult,
  CodeLanguage,
  CodeResult,
  Language,
  SolveResult,
} from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import type { AIProvider } from "../integrations/ai.js";
import { WIKIPEDIA_LICENSE } from "../integrations/wikipedia.js";
import { askSystem, codeSystem, parseSections, solveSystem, splitLines, stripCodeFence } from "./prompts.js";
import { needsWebSearch, SearchService, sentences } from "./searchService.js";
import { codeFromTemplate } from "./studyTools/codeTemplates.js";
import { solveLocally } from "./studyTools/mathSolver.js";

export type QuestionKind = "math" | "logic" | "code" | "general";

/** Rough classification used to route a question and to suggest the right tool. */
export function classifyQuestion(prompt: string): QuestionKind {
  if (/∧|∨|¬|→|↔|truth table|ақиқат(тық)? кесте|таблиц[аы] истинности/iu.test(prompt)) return "logic";
  if (/```|\b(code|function|program|python|javascript|java|c\+\+|c#)\b|код|бағдарлама|программ|функци/iu.test(prompt)) {
    return "code";
  }
  if (/\d\s*[+\-*/^=×÷:]\s*\d|\d[a-z]\s*[+\-=]|теңдеу|уравнен|equation|есепте|вычисл|calculate/iu.test(prompt)) {
    return "math";
  }
  return "general";
}

const OFFLINE_NOTE: Record<Language, string> = {
  kk: "AI моделі қосылмаған, сондықтан жауап Википедиядағы мақаланың қысқаша мазмұнынан құралды. Толық түсіндіру мен мысал алу үшін сайттың онлайн нұсқасында Профиль бетінде тегін кілтсіз AI-ды немесе Claude API кілтін қосыңыз.",
  ru: "AI-модель не подключена, поэтому ответ составлен из краткого содержания статьи Википедии. Для подробного объяснения и примера включите в Профиле онлайн-версии сайта бесплатный AI без ключа или добавьте ключ Claude API.",
  en: "No AI model is configured, so this answer is built from a Wikipedia article summary. For full explanations and examples, turn on the free keyless AI or add a Claude API key in Profile on the online version of the site.",
};

const NO_CITATIONS: Record<Language, string> = {
  kk: "Веб-іздеу сұралды, бірақ жауапта нақты сілтеме келтірілмеді. Маңызды деректерді өзіңіз тексеріңіз.",
  ru: "Был запрошен веб-поиск, но в ответе нет конкретных ссылок. Проверьте важные данные самостоятельно.",
  en: "Web search was requested, but the answer cites no specific links. Please verify important facts yourself.",
};

const OFFLINE_EXAMPLE: Record<Language, string> = {
  kk: "Мысал AI моделі қосылғанда жасалады.",
  ru: "Пример формируется, когда подключена AI-модель.",
  en: "An example is generated when an AI model is connected.",
};

export interface AskInput {
  prompt: string;
  language: Language;
  webSearch: boolean;
  requestId?: string;
}

export class AssistantService {
  constructor(
    private ai: AIProvider,
    private search: SearchService,
  ) {}

  get aiAvailable() {
    return this.ai.available;
  }

  async ask(input: AskInput): Promise<AskResult> {
    const useWeb = (input.webSearch || needsWebSearch(input.prompt)) && this.search.available;
    const response = this.ai.available
      ? await this.ai
          .complete({
            system: askSystem(input.language),
            prompt: input.prompt,
            webSearch: useWeb,
            reference: this.search.available,
            requestId: input.requestId,
          })
          .catch((error: unknown) => {
            // A failed or too slow AI still leaves the Wikipedia answer below.
            if (error instanceof AppError && error.code === "AI_UNAVAILABLE" && this.search.available) return null;
            throw error;
          })
      : null;
    if (response) {
      const s = parseSections(response.text);
      const uncertainty = [s.get("UNCERTAINTY") ?? ""]
        .filter((u) => u && u !== "-")
        .concat(useWeb && response.citations.length === 0 ? [NO_CITATIONS[input.language]] : []);
      return {
        summary: s.get("SUMMARY") || response.text.trim(),
        explanation: s.get("EXPLANATION") ?? "",
        example: s.get("EXAMPLE") ?? "",
        sources: response.citations,
        uncertainty: uncertainty.join("\n"),
        usedWebSearch: response.usedWebSearch,
        provider: "ai",
      };
    }
    // Offline: the answer comes only from search results, quoted briefly with attribution.
    const hits = await this.search.find(input.prompt, input.language, 3);
    const [top, ...rest] = hits;
    const topSentences = sentences(top.extract);
    const explanation = [topSentences.slice(2, 8).join(" "), ...rest.map((h) => `${h.title}: ${sentences(h.extract)[0] ?? ""}`)]
      .filter(Boolean)
      .join("\n\n");
    return {
      summary: topSentences.slice(0, 2).join(" "),
      explanation,
      example: OFFLINE_EXAMPLE[input.language],
      sources: SearchService.toLinks(hits),
      uncertainty: OFFLINE_NOTE[input.language],
      usedWebSearch: true,
      provider: "offline",
      license: `Wikipedia, ${WIKIPEDIA_LICENSE}`,
    };
  }

  async solve(prompt: string, language: Language, requestId?: string): Promise<SolveResult> {
    const local = solveLocally(prompt, language);
    if (local) return local;
    if (!this.ai.available) {
      throw new AppError("AI_UNAVAILABLE", "solveOffline");
    }
    const response = await this.ai.complete({ system: solveSystem(language), prompt, webSearch: false, requestId });
    const s = parseSections(response.text);
    return {
      given: s.get("GIVEN") ?? prompt,
      method: s.get("METHOD") ?? "",
      steps: splitLines(s.get("STEPS") ?? ""),
      answer: s.get("ANSWER") ?? response.text.trim(),
      check: s.get("CHECK") ?? "",
      provider: "ai",
    };
  }

  async code(prompt: string, codeLanguage: CodeLanguage, language: Language, requestId?: string): Promise<CodeResult> {
    if (this.ai.available) {
      const response = await this.ai.complete({
        system: codeSystem(language, codeLanguage),
        prompt,
        webSearch: false,
        requestId,
      });
      const s = parseSections(response.text);
      const dash = (v: string | undefined) => (v && v !== "-" ? stripCodeFence(v) : "");
      return {
        language: codeLanguage,
        code: stripCodeFence(s.get("CODE") ?? response.text),
        explanation: s.get("EXPLANATION") ?? "",
        sampleInput: dash(s.get("INPUT")),
        sampleOutput: dash(s.get("OUTPUT")),
        provider: "ai",
      };
    }
    const template = codeFromTemplate(prompt, codeLanguage, language);
    if (!template) {
      throw new AppError("AI_UNAVAILABLE", "codeOffline");
    }
    return template;
  }
}
