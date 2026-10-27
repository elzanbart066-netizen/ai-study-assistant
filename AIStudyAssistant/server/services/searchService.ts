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

  /** Returns hits ranked by the provider, dropping duplicates and empty extracts. */
  async find(query: string, language: Language, limit = 3): Promise<SearchHit[]> {
    if (!this.enabled) {
      throw new AppError("SEARCH_UNAVAILABLE", "disabled");
    }
    const hits = await this.provider.search(query, language, limit);
    const seen = new Set<string>();
    const unique = hits.filter((h) => {
      if (seen.has(h.url)) return false;
      seen.add(h.url);
      return h.extract.length > 40;
    });
    if (unique.length === 0) {
      throw new AppError("NO_SOURCES", "no results");
    }
    return unique;
  }

  static toLinks(hits: SearchHit[]): SourceLink[] {
    return hits.map(({ title, url, domain }) => ({ title, url, domain }));
  }
}

/** Splits text into sentences without breaking on initials or decimals too often. */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? []).map((s) => s.trim()).filter(Boolean);
}
