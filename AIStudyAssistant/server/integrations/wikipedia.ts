import type { Language, SourceLink } from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";

export interface SearchHit extends SourceLink {
  extract: string;
}

/** Contract for the web search integration. */
export interface SearchProvider {
  search(query: string, language: Language, limit?: number): Promise<SearchHit[]>;
}

type FetchFn = typeof fetch;

/**
 * Searches Wikipedia in the student's language through the public MediaWiki API.
 * Wikipedia text is CC BY-SA 4.0: callers must show the article link and the
 * license next to any text taken from it.
 */
export class WikipediaSearch implements SearchProvider {
  constructor(private fetchFn: FetchFn = fetch) {}

  async search(query: string, language: Language, limit = 3): Promise<SearchHit[]> {
    const base = `https://${language}.wikipedia.org/w/api.php`;
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: query,
      gsrlimit: String(limit),
      prop: "extracts|info",
      exintro: "1",
      explaintext: "1",
      exlimit: String(limit),
      inprop: "url",
      origin: "*",
    });
    let data: {
      query?: { pages?: Record<string, { title: string; fullurl: string; extract?: string; index?: number }> };
    };
    try {
      const response = await this.fetchFn(`${base}?${params}`, {
        headers: { "User-Agent": "AIStudyAssistant/1.0 (educational project)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      data = (await response.json()) as typeof data;
    } catch {
      throw new AppError("SEARCH_UNAVAILABLE", "search failed");
    }
    const pages = Object.values(data.query?.pages ?? {});
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return pages
      .filter((p) => p.extract && p.extract.trim().length > 0)
      .map((p) => ({
        title: p.title,
        url: p.fullurl,
        domain: `${language}.wikipedia.org`,
        extract: p.extract?.trim() ?? "",
      }));
  }
}

export const WIKIPEDIA_LICENSE = "CC BY-SA 4.0";
