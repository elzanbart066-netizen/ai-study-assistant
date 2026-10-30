import type { Language, SourceLink } from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";

export interface SearchHit extends SourceLink {
  extract: string;
}

/** Contract for the web search integration. */
export interface SearchProvider {
  search(query: string, language: Language, limit?: number): Promise<SearchHit[]>;
  /** The provider's own spelling correction ("did you mean"), if it has one. */
  suggest?(query: string, language: Language): Promise<string | null>;
}

type FetchFn = typeof fetch;

/**
 * Searches Wikipedia in the student's language through the public MediaWiki API.
 * Wikipedia text is CC BY-SA 4.0: callers must show the article link and the
 * license next to any text taken from it.
 */
export class WikipediaSearch implements SearchProvider {
  constructor(private fetchFn: FetchFn = fetch) {}

  private async request<T>(language: Language, params: Record<string, string>): Promise<T> {
    const base = `https://${language}.wikipedia.org/w/api.php`;
    const query = new URLSearchParams({ action: "query", format: "json", origin: "*", ...params });
    try {
      const response = await this.fetchFn(`${base}?${query}`, {
        headers: { "User-Agent": "AIStudyAssistant/1.0 (educational project)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } catch {
      throw new AppError("SEARCH_UNAVAILABLE", "search failed");
    }
  }

  async search(query: string, language: Language, limit = 3): Promise<SearchHit[]> {
    const data = await this.request<{
      query?: { pages?: Record<string, { title: string; fullurl: string; extract?: string; index?: number }> };
    }>(language, {
      generator: "search",
      gsrsearch: query,
      gsrlimit: String(limit),
      prop: "extracts|info",
      exintro: "1",
      explaintext: "1",
      exlimit: String(limit),
      inprop: "url",
    });
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

  async suggest(query: string, language: Language): Promise<string | null> {
    const data = await this.request<{ query?: { searchinfo?: { suggestion?: string } } }>(language, {
      list: "search",
      srsearch: query,
      srinfo: "suggestion",
      srprop: "",
      srlimit: "1",
    });
    return data.query?.searchinfo?.suggestion ?? null;
  }
}

export const WIKIPEDIA_LICENSE = "CC BY-SA 4.0";
