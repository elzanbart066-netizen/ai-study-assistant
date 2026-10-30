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
   * The question is reduced to its key words first; if the student's language
   * has no article, the other Wikipedia languages are tried in turn.
   */
  async find(query: string, language: Language, limit = 3): Promise<SearchHit[]> {
    if (!this.enabled) {
      throw new AppError("SEARCH_UNAVAILABLE", "disabled");
    }
    const terms = searchTerms(query) || query;
    let failures = 0;
    for (const lang of searchLanguages(language)) {
      let hits: SearchHit[];
      try {
        hits = await this.provider.search(terms, lang, limit);
      } catch {
        failures++;
        continue;
      }
      const seen = new Set<string>();
      const unique = hits.filter((h) => {
        if (seen.has(h.url)) return false;
        seen.add(h.url);
        return h.extract.length > 40;
      });
      if (unique.length > 0) return unique;
    }
    if (failures === searchLanguages(language).length) {
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
