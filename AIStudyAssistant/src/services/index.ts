import type {
  AskResult,
  CodeLanguage,
  CodeResult,
  FileFormat,
  FileResult,
  HistoryEntry,
  HistoryStats,
  ImageResult,
  Language,
  PublicUser,
  SolveResult,
  SourceLink,
  ToolType,
} from "../models/index.js";
import { api } from "./api.js";

interface Saved {
  messageId?: string;
  conversationId?: string;
}

export const authService = {
  me: () => api.get<{ user: PublicUser | null }>("/auth/me"),
  login: (email: string, password: string) => api.post<{ user: PublicUser }>("/auth/login", { email, password }),
  register: (input: { name: string; email: string; password: string; passwordConfirm: string; language: Language }) =>
    api.post<{ user: PublicUser }>("/auth/register", input),
  logout: () => api.post<{ ok: true }>("/auth/logout"),
};

export const profileService = {
  update: (input: { name?: string; saveHistory?: boolean }) => api.put<{ user: PublicUser }>("/profile", input),
  setLanguage: (language: Language) => api.put<{ user: PublicUser }>("/profile/language", { language }),
};

export const assistantService = {
  ask: (prompt: string, webSearch: boolean, language: Language) =>
    api.post<{ result: AskResult; kind: "math" | "logic" | "code" | "general" } & Saved>("/assistant/ask", {
      prompt,
      webSearch,
      language,
    }),
  solve: (prompt: string, language: Language) =>
    api.post<{ result: SolveResult } & Saved>("/assistant/solve", { prompt, language }),
  code: (prompt: string, codeLanguage: CodeLanguage, language: Language) =>
    api.post<{ result: CodeResult } & Saved>("/assistant/code", { prompt, codeLanguage, language }),
};

export const fileService = {
  create: (input: { title: string; instruction: string; format: FileFormat; language: Language }) =>
    api.post<{ result: FileResult; messageId: string | null }>("/files/create", input),
};

export const imageService = {
  save: (input: { original: string; edited: string; operations: string[]; instruction: string; language: Language }) =>
    api.post<{ result: ImageResult; messageId: string | null }>("/images/edit", input),
};

export interface HistoryFilter {
  q?: string;
  type?: ToolType | "";
  from?: string;
  to?: string;
  saved?: boolean;
  sort?: "newest" | "oldest";
  page?: number;
  limit?: number;
}

export interface HistoryDetail {
  id: string;
  type: ToolType;
  prompt: string;
  language: Language;
  createdAt: string;
  result: unknown;
  sources: SourceLink[];
}

export const historyService = {
  list: (filter: HistoryFilter) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== "" && v !== false) params.set(k, v === true ? "1" : String(v));
    }
    return api.get<{ items: HistoryEntry[]; total: number; page: number; limit: number }>(`/history?${params}`);
  },
  get: (id: string) => api.get<HistoryDetail>(`/history/${id}`),
  remove: (id: string) => api.del<void>(`/history/${id}`),
  setSaved: (id: string, saved: boolean) => api.put<{ ok: true }>(`/history/${id}/saved`, { saved }),
  stats: () => api.get<HistoryStats & { byLanguage: Record<Language, number> }>("/history/stats"),
};
