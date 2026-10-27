import type {
  HistoryStats,
  Language,
  Message,
  Source,
  SourceLink,
  ToolType,
} from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import { newId, nowIso } from "../lib/ids.js";
import type { FileStorage } from "../lib/storage.js";
import { validateToolType } from "../lib/validation.js";
import type { DataStore } from "../repositories/types.js";

export interface RecordInput {
  userId: string;
  type: ToolType;
  prompt: string;
  answer: unknown;
  language: Language;
  sources?: SourceLink[];
  conversationId?: string;
}

export class HistoryService {
  constructor(
    private store: DataStore,
    private storage: FileStorage,
  ) {}

  /** Saves a tool result if the student keeps history; returns the message id. */
  async record(input: RecordInput): Promise<{ messageId: string; conversationId: string } | null> {
    const settings = await this.store.getSettings(input.userId);
    if (settings && !settings.saveHistory) {
      return null;
    }
    let conversationId = input.conversationId;
    if (conversationId) {
      const existing = await this.store.findConversation(conversationId);
      if (!existing || existing.userId !== input.userId) conversationId = undefined;
    }
    if (!conversationId) {
      conversationId = newId();
      await this.store.createConversation({
        id: conversationId,
        userId: input.userId,
        title: input.prompt.slice(0, 120),
        createdAt: nowIso(),
      });
    }
    const message: Message = {
      id: newId(),
      conversationId,
      userId: input.userId,
      type: input.type,
      prompt: input.prompt,
      answer: JSON.stringify(input.answer),
      status: "done",
      language: input.language,
      createdAt: nowIso(),
    };
    const retrievedAt = nowIso();
    const sources: Source[] = (input.sources ?? []).map((s) => ({
      id: newId(),
      messageId: message.id,
      title: s.title.slice(0, 300),
      url: s.url,
      domain: s.domain,
      retrievedAt,
    }));
    await this.store.saveMessageWithSources(message, sources);
    return { messageId: message.id, conversationId };
  }

  async list(userId: string, query: Record<string, unknown>) {
    const text = typeof query.q === "string" ? query.q.trim().slice(0, 200) : undefined;
    const type = query.type ? validateToolType(query.type) : undefined;
    const isDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const to = isDate(query.to) ? new Date(`${query.to.slice(0, 10)}T23:59:59.999Z`).toISOString() : undefined;
    const result = await this.store.searchHistory({
      userId,
      text: text || undefined,
      type,
      from: isDate(query.from) ? new Date(query.from).toISOString() : undefined,
      to,
      savedOnly: query.saved === "1" || query.saved === "true",
      sort: query.sort === "oldest" ? "oldest" : "newest",
      limit,
      offset: (page - 1) * limit,
    });
    return { ...result, page, limit };
  }

  private async owned(userId: string, id: string): Promise<Message> {
    const message = await this.store.findMessage(id);
    if (!message) throw new AppError("NOT_FOUND", "message");
    if (message.userId !== userId) throw new AppError("FORBIDDEN", "message");
    return message;
  }

  async get(userId: string, id: string) {
    const message = await this.owned(userId, id);
    const sources = await this.store.listSources(id);
    return {
      id: message.id,
      conversationId: message.conversationId,
      type: message.type,
      prompt: message.prompt,
      language: message.language,
      createdAt: message.createdAt,
      result: JSON.parse(message.answer) as unknown,
      sources: sources.map(({ title, url, domain }) => ({ title, url, domain })),
    };
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    const assets = await this.store.deleteMessage(id);
    await Promise.all(assets.map((a) => this.storage.remove(a.filePath)));
  }

  async setSaved(userId: string, id: string, saved: boolean, label?: unknown) {
    const message = await this.owned(userId, id);
    if (saved) {
      const text = typeof label === "string" && label.trim() ? label.trim().slice(0, 120) : message.prompt.slice(0, 120);
      await this.store.saveItem({ id: newId(), userId, messageId: id, label: text, createdAt: nowIso() });
    } else {
      await this.store.removeSavedItem(userId, id);
    }
  }

  async stats(userId: string): Promise<HistoryStats & { byLanguage: Record<Language, number> }> {
    const [stats, byLanguage] = await Promise.all([this.store.stats(userId), this.store.countByLanguage(userId)]);
    return { ...stats, byLanguage };
  }
}
