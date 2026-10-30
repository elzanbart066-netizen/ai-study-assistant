import type { Language, SourceLink } from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import type { SearchHit, SearchProvider } from "../integrations/wikipedia.js";

const TIME_SENSITIVE =
  /\b(20[2-9]\d|today|latest|current|recent|news|now)\b|қазір|биыл|жаңа(лық)?|соңғы|бүгін|сегодня|сейчас|последн|новост|актуальн|текущ/iu;

/** Decides whether a question needs fresh data from the internet. */
export function needsWebSearch(prompt: string): boolean {
  return TIME_SENSITIVE.test(prompt);
}

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
   * progressively looser queries in each Wikipedia language: as written,
   * typo-tolerant words, Wikipedia's own spelling suggestion, and finally the
   * single words of the question, longest first.
   */
  async find(query: string, language: Language, limit = 3): Promise<SearchHit[]> {
    if (!this.enabled) {
      throw new AppError("SEARCH_UNAVAILABLE", "disabled");
    }
    const terms = searchTerms(query) || query;
    let calls = 0;
    let failures = 0;
    const attempt = async (q: string, lang: Language) => {
      calls++;
      try {
        return dedupe(await this.provider.search(q, lang, limit));
      } catch {
        failures++;
        return [];
      }
    };

    const tried = new Set<string>();
    const run = async (q: string | null | undefined, lang: Language) => {
      if (!q || tried.has(`${lang}:${q}`)) return [];
      tried.add(`${lang}:${q}`);
      return attempt(q, lang);
    };
    const languages = searchLanguages(language);

    // Pass 1: the whole question, as written, typo-tolerant, and as Wikipedia would correct it.
    for (const lang of languages) {
      for (const q of [terms, fuzzyQuery(terms)]) {
        const found = await run(q, lang);
        if (found.length) return found;
      }
      if (this.provider.suggest) {
        const suggestion = await this.provider.suggest(terms, lang).catch(() => null);
        for (const q of [suggestion, suggestion && fuzzyQuery(suggestion)]) {
          const found = await run(q, lang);
          if (found.length) return found;
        }
      }
    }
    // Pass 2: single words, longest first, when no article matches the whole question.
    const words = terms.split(" ").filter((w) => [...w].length >= 4);
    if (words.length > 1) {
      for (const lang of languages) {
        for (const word of [...words].sort((x, y) => [...y].length - [...x].length)) {
          const found = await run(fuzzyQuery(word), lang);
          if (found.length) return found;
        }
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
