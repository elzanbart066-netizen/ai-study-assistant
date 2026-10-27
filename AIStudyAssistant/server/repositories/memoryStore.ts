import type {
  Conversation,
  GeneratedAsset,
  HistoryEntry,
  HistoryStats,
  Language,
  Message,
  SavedItem,
  Source,
  User,
  UserSettings,
} from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import type { DataStore, HistoryQuery } from "./types.js";

/** In-memory implementation used for the prototype, the demo mode and tests. */
export class MemoryStore implements DataStore {
  private users = new Map<string, User>();
  private settings = new Map<string, UserSettings>();
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, Message>();
  private sources = new Map<string, Source>();
  private assets = new Map<string, GeneratedAsset>();
  private saved = new Map<string, SavedItem>();

  async createUser(user: User, settings: UserSettings) {
    if (await this.findUserByEmail(user.email)) {
      throw new AppError("EMAIL_TAKEN", "email", "email");
    }
    this.users.set(user.id, { ...user });
    this.settings.set(user.id, { ...settings });
  }

  async findUserByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return { ...user };
      }
    }
    return null;
  }

  async findUserById(id: string) {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async updateUserName(id: string, name: string) {
    const user = this.users.get(id);
    if (user) {
      user.name = name;
    }
  }

  async getSettings(userId: string) {
    const s = this.settings.get(userId);
    return s ? { ...s } : null;
  }

  async updateSettings(userId: string, patch: Partial<Pick<UserSettings, "language" | "saveHistory">>) {
    const s = this.settings.get(userId);
    if (s) {
      Object.assign(s, patch);
    }
  }

  async createConversation(conversation: Conversation) {
    this.conversations.set(conversation.id, { ...conversation });
  }

  async findConversation(id: string) {
    const c = this.conversations.get(id);
    return c ? { ...c } : null;
  }

  async saveMessageWithSources(message: Message, sources: Source[]) {
    if (!this.conversations.has(message.conversationId)) {
      // Mirrors the foreign key in MySQL: nothing is written on failure.
      throw new AppError("DB_UNAVAILABLE", "conversation missing");
    }
    this.messages.set(message.id, { ...message });
    for (const s of sources) {
      this.sources.set(s.id, { ...s });
    }
  }

  async findMessage(id: string) {
    const m = this.messages.get(id);
    return m ? { ...m } : null;
  }

  async listSources(messageId: string) {
    return [...this.sources.values()].filter((s) => s.messageId === messageId).map((s) => ({ ...s }));
  }

  async searchHistory(q: HistoryQuery) {
    const text = q.text?.toLowerCase();
    const savedIds = new Set(
      [...this.saved.values()].filter((s) => s.userId === q.userId).map((s) => s.messageId),
    );
    let rows = [...this.messages.values()].filter(
      (m) =>
        m.userId === q.userId &&
        (!q.type || m.type === q.type) &&
        (!text || m.prompt.toLowerCase().includes(text)) &&
        (!q.from || m.createdAt >= q.from) &&
        (!q.to || m.createdAt <= q.to) &&
        (!q.savedOnly || savedIds.has(m.id)),
    );
    rows.sort((a, b) => (q.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
    const total = rows.length;
    const offset = q.offset ?? 0;
    rows = rows.slice(offset, offset + (q.limit ?? 50));
    const sourceCounts = new Map<string, number>();
    for (const s of this.sources.values()) {
      sourceCounts.set(s.messageId, (sourceCounts.get(s.messageId) ?? 0) + 1);
    }
    const items: HistoryEntry[] = rows.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      type: m.type,
      prompt: m.prompt,
      status: m.status,
      language: m.language,
      createdAt: m.createdAt,
      saved: savedIds.has(m.id),
      sourceCount: sourceCounts.get(m.id) ?? 0,
    }));
    return { items, total };
  }

  async deleteMessage(id: string) {
    const removed: GeneratedAsset[] = [];
    this.messages.delete(id);
    for (const [key, s] of this.sources) {
      if (s.messageId === id) this.sources.delete(key);
    }
    for (const [key, s] of this.saved) {
      if (s.messageId === id) this.saved.delete(key);
    }
    for (const [key, a] of this.assets) {
      if (a.messageId === id) {
        removed.push(a);
        this.assets.delete(key);
      }
    }
    return removed;
  }

  async createAssets(assets: GeneratedAsset[]) {
    for (const a of assets) {
      this.assets.set(a.id, { ...a });
    }
  }

  async findAsset(id: string) {
    const a = this.assets.get(id);
    return a ? { ...a } : null;
  }

  async attachAssets(assetIds: string[], messageId: string) {
    for (const id of assetIds) {
      const a = this.assets.get(id);
      if (a) a.messageId = messageId;
    }
  }

  async saveItem(item: SavedItem) {
    for (const s of this.saved.values()) {
      if (s.userId === item.userId && s.messageId === item.messageId) {
        s.label = item.label;
        return;
      }
    }
    this.saved.set(item.id, { ...item });
  }

  async removeSavedItem(userId: string, messageId: string) {
    for (const [key, s] of this.saved) {
      if (s.userId === userId && s.messageId === messageId) this.saved.delete(key);
    }
  }

  async stats(userId: string): Promise<HistoryStats> {
    const byType = { ask: 0, solve: 0, code: 0, file: 0, image: 0 };
    let total = 0;
    for (const m of this.messages.values()) {
      if (m.userId === userId) {
        total++;
        byType[m.type]++;
      }
    }
    let filesCreated = 0;
    let imagesEdited = 0;
    for (const a of this.assets.values()) {
      if (a.userId !== userId) continue;
      if (a.kind === "file") filesCreated++;
      else if (a.name.startsWith("edited")) imagesEdited++;
    }
    const savedCount = [...this.saved.values()].filter((s) => s.userId === userId).length;
    return { total, byType, filesCreated, imagesEdited, savedCount };
  }

  async countByLanguage(userId: string) {
    const counts: Record<Language, number> = { kk: 0, ru: 0, en: 0 };
    for (const m of this.messages.values()) {
      if (m.userId === userId) counts[m.language]++;
    }
    return counts;
  }

  async close() {}
}
