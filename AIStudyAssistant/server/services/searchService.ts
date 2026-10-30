import type { Language, SourceLink } from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import type { SearchHit, SearchProvider } from "../integrations/wikipedia.js";

const TIME_SENSITIVE =
  /\b(20[2-9]\d|today|latest|current|recent|news|now)\b|қазір|биыл|жаңа(лық)?|соңғы|бүгін|сегодня|сейчас|последн|новост|актуальн|текущ/iu;

/** Decides whether a question needs fresh data from the internet. */
export function needsWebSearch(prompt: string): boolean {
  return TIME_SENSITIVE.test(prompt);
}

/** The whole search gives up after this long, so a slow network never leaves the student waiting. */
const SEARCH_BUDGET_MS = 15_000;

export class SearchService {
  constructor(
    private provider: SearchProvider,
    private enabled: boolean,
  ) {}

  get available() {
    return this.enabled;
  }

  /**
   * Returns hits ranked by the provider, dropping duplicates and empty extracts.
   * The question is reduced to its key words first, then searched with
   * progressively looser queries: as written, typo-tolerant words, Wikipedia's
   * own spelling suggestion, and finally the single words of the question,
   * longest first. Each step asks every Wikipedia language at once and prefers
   * the student's language; the whole search stops after `budgetMs`.
   */
  async find(query: string, language: Language, limit = 3, budgetMs = SEARCH_BUDGET_MS): Promise<SearchHit[]> {
    if (!this.enabled) {
      throw new AppError("SEARCH_UNAVAILABLE", "disabled");
    }
    const terms = searchTerms(query) || query;
    const deadline = Date.now() + budgetMs;
    const languages = searchLanguages(language);
    let calls = 0;
    let failures = 0;
    const tried = new Set<string>();
    const run = async (q: string | null | undefined, lang: Language) => {
      if (!q || tried.has(`${lang}:${q}`)) return [];
      tried.add(`${lang}:${q}`);
      calls++;
      try {
        return dedupe(await this.provider.search(q, lang, limit));
      } catch {
        failures++;
        return [];
      }
    };
    // One step: the same kind of query in every language at once, first non-empty wins.
    const step = async (queryFor: (lang: Language) => string | null | undefined) => {
      if (Date.now() > deadline) return [];
      const results = await Promise.all(languages.map((lang) => run(queryFor(lang), lang)));
      return results.find((r) => r.length > 0) ?? [];
    };

    for (const q of [terms, fuzzyQuery(terms)]) {
      const found = await step(() => q);
      if (found.length) return found;
    }
    // Spelling suggestions are fetched only when the plain and fuzzy queries found nothing.
    if (this.provider.suggest && Date.now() <= deadline) {
      const suggest = this.provider.suggest.bind(this.provider);
      const list = await Promise.all(languages.map((lang) => suggest(terms, lang).catch(() => null)));
      const suggestions = new Map(languages.map((lang, i) => [lang, list[i]]));
      for (const fuzzy of [false, true]) {
        const found = await step((lang) => {
          const suggestion = suggestions.get(lang);
          return suggestion && (fuzzy ? fuzzyQuery(suggestion) : suggestion);
        });
        if (found.length) return found;
      }
    }
    // Single words, longest first, when no article matches the whole question.
    const words = terms.split(" ").filter((w) => [...w].length >= 4);
    if (words.length > 1) {
      for (const word of [...words].sort((x, y) => [...y].length - [...x].length).slice(0, 3)) {
        const found = await step(() => fuzzyQuery(word));
        if (found.length) return found;
      }
    }
    if (calls > 0 && failures === calls) {
      throw new AppError("SEARCH_UNAVAILABLE", "search failed");
    }
    throw new AppError("NO_SOURCES", "no results");
  }

  static toLinks(hits: SearchHit[]): SourceLink[] {
    return hits.map(({ title, url, domain }) => ({ title, url, domain }));
  }
}

/** Splits text into sentences without breaking on initials or decimals too often. */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

// Question words and filler that only add noise to an encyclopedia search.
const QUESTION_WORDS = [
  // kk
  "дегеніміз не", "деген не", "дегеніміз", "деген", "дегенді", "не", "неге", "қандай", "қалай", "қашан", "қайда", "кім", "қанша",
  "туралы", "жайлы", "айтып бер", "айтып беріңіз", "түсіндір", "түсіндіріңіз", "мысалмен", "мысал", "жаз", "жазып бер",
  "ма", "ме", "ба", "бе", "па", "пе", "және", "мен",
  // ru
  "что такое", "кто такой", "кто такая", "кто такие", "что", "кто", "как", "почему", "зачем", "когда", "где", "сколько", "какой", "какая",
  "расскажи", "расскажите", "объясни", "объясните", "про", "о", "об", "это", "такое", "с примером", "пример", "и", "в", "на",
  // en
  "what is", "what are", "who is", "who was", "what", "who", "how", "why", "when", "where", "which", "tell me about",
  "explain", "describe", "with example", "example", "about", "is", "are", "the", "a", "an", "does", "do", "please",
];

const QUESTION_RE = new RegExp(
  `(?<!\\p{L})(${[...QUESTION_WORDS].sort((a, b) => b.length - a.length).join("|")})(?!\\p{L})`,
  "giu",
);

/** Reduces a question to the words worth searching for ("Фотосинтез деген не?" -> "Фотосинтез"). */
export function searchTerms(prompt: string): string {
  return prompt
    .replace(/[?!.,;:«»"“”()]/g, " ")
    .replace(QUESTION_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The student's language first, then the larger Wikipedias: Russian, English, Kazakh. */
export function searchLanguages(language: Language): Language[] {
  return [language, ...(["ru", "en", "kk"] as const).filter((l) => l !== language)];
}

function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (seen.has(h.url)) return false;
    seen.add(h.url);
    return h.extract.length > 40;
  });
}

/**
 * Marks longer words for fuzzy matching (Wikipedia's `word~`), so
 * "казакстан призденті" still finds "Қазақстан Президенті". Wikipedia allows
 * up to two edits per word; the spelling suggestion covers bigger mistakes.
 */
export function fuzzyQuery(terms: string): string {
  return terms
    .split(" ")
    .map((w) => ([...w].length >= 4 && !w.endsWith("~") ? `${w}~` : w))
    .join(" ");
}
