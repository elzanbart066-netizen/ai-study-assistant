import type {
  Conversation,
  GeneratedAsset,
  HistoryEntry,
  HistoryStats,
  Language,
  Message,
  SavedItem,
  Source,
  ToolType,
  User,
  UserSettings,
} from "../../src/models/index.js";

export interface HistoryQuery {
  userId: string;
  text?: string;
  type?: ToolType;
  from?: string;
  to?: string;
  savedOnly?: boolean;
  sort?: "newest" | "oldest";
  limit?: number;
  offset?: number;
}

/**
 * Data access contract. Both the in-memory store (prototype, tests) and the
 * MySQL store implement it, so services never depend on a concrete database.
 */
export interface DataStore {
  // users
  createUser(user: User, settings: UserSettings): Promise<void>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  updateUserName(id: string, name: string): Promise<void>;
  getSettings(userId: string): Promise<UserSettings | null>;
  updateSettings(userId: string, patch: Partial<Pick<UserSettings, "language" | "saveHistory">>): Promise<void>;

  // conversations and messages
  createConversation(conversation: Conversation): Promise<void>;
  findConversation(id: string): Promise<Conversation | null>;
  /** Saves a message together with its sources in a single transaction. */
  saveMessageWithSources(message: Message, sources: Source[]): Promise<void>;
  findMessage(id: string): Promise<Message | null>;
  listSources(messageId: string): Promise<Source[]>;
  searchHistory(query: HistoryQuery): Promise<{ items: HistoryEntry[]; total: number }>;
  /** Deletes a message, its sources, saved items and asset records in one transaction. */
  deleteMessage(id: string): Promise<GeneratedAsset[]>;

  // generated files and images
  createAssets(assets: GeneratedAsset[]): Promise<void>;
  findAsset(id: string): Promise<GeneratedAsset | null>;
  attachAssets(assetIds: string[], messageId: string): Promise<void>;

  // saved items
  saveItem(item: SavedItem): Promise<void>;
  removeSavedItem(userId: string, messageId: string): Promise<void>;

  // aggregates
  stats(userId: string): Promise<HistoryStats>;
  countByLanguage(userId: string): Promise<Record<Language, number>>;

  close(): Promise<void>;
}
