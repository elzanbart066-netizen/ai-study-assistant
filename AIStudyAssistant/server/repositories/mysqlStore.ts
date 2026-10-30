import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

// All statements are parameterized; no user input is concatenated into SQL.

const toDate = (iso: string) => new Date(iso);
const toIso = (value: Date | string) => new Date(value).toISOString();

function wrap(error: unknown): never {
  if (error instanceof AppError) throw error;
  const code = (error as { code?: string }).code;
  if (code === "ER_DUP_ENTRY") throw new AppError("EMAIL_TAKEN", "email", "email");
  throw new AppError("DB_UNAVAILABLE", code ?? "db");
}

export class MySqlStore implements DataStore {
  private constructor(private pool: Pool) {}

  static async connect(url: string, rootDir: string) {
    const pool = mysql.createPool({ uri: url, connectionLimit: 10, charset: "utf8mb4", multipleStatements: true });
    const schema = await readFile(path.join(rootDir, "database", "schema.sql"), "utf8");
    await pool.query(schema);
    return new MySqlStore(pool);
  }

  private async tx<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection().catch(wrap);
    try {
      await conn.beginTransaction();
      const result = await work(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback().catch(() => {});
      wrap(error);
    } finally {
      conn.release();
    }
  }

  private async rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
      return rows as T[];
    } catch (error) {
      wrap(error);
    }
  }

  private async exec(sql: string, params: unknown[] = []) {
    try {
      await this.pool.execute(sql, params as never);
    } catch (error) {
      wrap(error);
    }
  }

  async createUser(user: User, settings: UserSettings) {
    await this.tx(async (conn) => {
      await conn.execute(
        "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [user.id, user.name, user.email, user.passwordHash, user.role, toDate(user.createdAt)],
      );
      await conn.execute("INSERT INTO user_settings (user_id, language, save_history) VALUES (?, ?, ?)", [
        settings.userId,
        settings.language,
        settings.saveHistory,
      ]);
    });
  }

  private mapUser(r: Record<string, unknown>): User {
    return {
      id: r.id as string,
      name: r.name as string,
      email: r.email as string,
      passwordHash: r.password_hash as string,
      role: r.role as User["role"],
      createdAt: toIso(r.created_at as Date),
    };
  }

  async findUserByEmail(email: string) {
    const [row] = await this.rows<Record<string, unknown>>("SELECT * FROM users WHERE email = ?", [email]);
    return row ? this.mapUser(row) : null;
  }

  async findUserById(id: string) {
    const [row] = await this.rows<Record<string, unknown>>("SELECT * FROM users WHERE id = ?", [id]);
    return row ? this.mapUser(row) : null;
  }

  async updateUserName(id: string, name: string) {
    await this.exec("UPDATE users SET name = ? WHERE id = ?", [name, id]);
  }

  async getSettings(userId: string) {
    const [row] = await this.rows<{ user_id: string; language: Language; save_history: number }>(
      "SELECT * FROM user_settings WHERE user_id = ?",
      [userId],
    );
    return row ? { userId: row.user_id, language: row.language, saveHistory: Boolean(row.save_history) } : null;
  }

  async updateSettings(userId: string, patch: Partial<Pick<UserSettings, "language" | "saveHistory">>) {
    if (patch.language !== undefined) {
      await this.exec("UPDATE user_settings SET language = ? WHERE user_id = ?", [patch.language, userId]);
    }
    if (patch.saveHistory !== undefined) {
      await this.exec("UPDATE user_settings SET save_history = ? WHERE user_id = ?", [patch.saveHistory, userId]);
    }
  }

  async createConversation(c: Conversation) {
    await this.exec("INSERT INTO conversations (id, user_id, title, created_at) VALUES (?, ?, ?, ?)", [
      c.id,
      c.userId,
      c.title,
      toDate(c.createdAt),
    ]);
  }

  async findConversation(id: string) {
    const [r] = await this.rows<Record<string, unknown>>("SELECT * FROM conversations WHERE id = ?", [id]);
    return r
      ? { id: r.id as string, userId: r.user_id as string, title: r.title as string, createdAt: toIso(r.created_at as Date) }
      : null;
  }

  async saveMessageWithSources(m: Message, sources: Source[]) {
    await this.tx(async (conn) => {
      await conn.execute(
        "INSERT INTO messages (id, conversation_id, user_id, type, prompt, answer, status, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [m.id, m.conversationId, m.userId, m.type, m.prompt, m.answer, m.status, m.language, toDate(m.createdAt)],
      );
      for (const s of sources) {
        await conn.execute(
          "INSERT INTO sources (id, message_id, title, url, domain, retrieved_at) VALUES (?, ?, ?, ?, ?, ?)",
          [s.id, s.messageId, s.title, s.url, s.domain, toDate(s.retrievedAt)],
        );
      }
    });
  }

  private mapMessage(r: Record<string, unknown>): Message {
    return {
      id: r.id as string,
      conversationId: r.conversation_id as string,
      userId: r.user_id as string,
      type: r.type as Message["type"],
      prompt: r.prompt as string,
      answer: r.answer as string,
      status: r.status as Message["status"],
      language: r.language as Language,
      createdAt: toIso(r.created_at as Date),
    };
  }

  async findMessage(id: string) {
    const [r] = await this.rows<Record<string, unknown>>("SELECT * FROM messages WHERE id = ?", [id]);
    return r ? this.mapMessage(r) : null;
  }

  async listSources(messageId: string) {
    const rows = await this.rows<Record<string, unknown>>(
      "SELECT * FROM sources WHERE message_id = ? ORDER BY retrieved_at",
      [messageId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      messageId: r.message_id as string,
      title: r.title as string,
      url: r.url as string,
      domain: r.domain as string,
      retrievedAt: toIso(r.retrieved_at as Date),
    }));
  }

  async searchHistory(q: HistoryQuery) {
    const where = ["m.user_id = ?"];
    const params: unknown[] = [q.userId];
    if (q.type) {
      where.push("m.type = ?");
      params.push(q.type);
    }
    if (q.text) {
      where.push("m.prompt LIKE ?");
      params.push(`%${q.text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    }
    if (q.from) {
      where.push("m.created_at >= ?");
      params.push(toDate(q.from));
    }
    if (q.to) {
      where.push("m.created_at <= ?");
      params.push(toDate(q.to));
    }
    if (q.savedOnly) {
      where.push("s.id IS NOT NULL");
    }
    const from = `FROM messages m LEFT JOIN saved_items s ON s.message_id = m.id AND s.user_id = m.user_id WHERE ${where.join(" AND ")}`;
    const [count] = await this.rows<{ total: number }>(`SELECT COUNT(*) AS total ${from}`, params);
    const order = q.sort === "oldest" ? "ASC" : "DESC";
    const rows = await this.rows<Record<string, unknown>>(
      `SELECT m.id, m.conversation_id, m.type, m.prompt, m.status, m.language, m.created_at,
              s.id IS NOT NULL AS saved,
              (SELECT COUNT(*) FROM sources src WHERE src.message_id = m.id) AS source_count
       ${from} ORDER BY m.created_at ${order} LIMIT ? OFFSET ?`,
      [...params, q.limit ?? 50, q.offset ?? 0],
    );
    const items: HistoryEntry[] = rows.map((r) => ({
      id: r.id as string,
      conversationId: r.conversation_id as string,
      type: r.type as HistoryEntry["type"],
      prompt: r.prompt as string,
      status: r.status as HistoryEntry["status"],
      language: r.language as Language,
      createdAt: toIso(r.created_at as Date),
      saved: Boolean(r.saved),
      sourceCount: Number(r.source_count),
    }));
    return { items, total: Number(count?.total ?? 0) };
  }

  async deleteMessage(id: string) {
    return this.tx(async (conn) => {
      const [assetRows] = await conn.query<RowDataPacket[]>("SELECT * FROM generated_assets WHERE message_id = ?", [id]);
      const assets = assetRows.map((r) => this.mapAsset(r));
      await conn.execute("DELETE FROM generated_assets WHERE message_id = ?", [id]);
      await conn.execute("DELETE FROM saved_items WHERE message_id = ?", [id]);
      await conn.execute("DELETE FROM sources WHERE message_id = ?", [id]);
      await conn.execute("DELETE FROM messages WHERE id = ?", [id]);
      return assets;
    });
  }

  private mapAsset(r: Record<string, unknown>): GeneratedAsset {
    return {
      id: r.id as string,
      userId: r.user_id as string,
      messageId: (r.message_id as string | null) ?? null,
      kind: r.kind as GeneratedAsset["kind"],
      format: r.format as string,
      name: r.name as string,
      size: Number(r.size),
      filePath: r.file_path as string,
      createdAt: toIso(r.created_at as Date),
    };
  }

  async createAssets(assets: GeneratedAsset[]) {
    await this.tx(async (conn) => {
      for (const a of assets) {
        await conn.execute(
          "INSERT INTO generated_assets (id, user_id, message_id, kind, format, name, size, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [a.id, a.userId, a.messageId, a.kind, a.format, a.name, a.size, a.filePath, toDate(a.createdAt)],
        );
      }
    });
  }

  async findAsset(id: string) {
    const [r] = await this.rows<Record<string, unknown>>("SELECT * FROM generated_assets WHERE id = ?", [id]);
    return r ? this.mapAsset(r) : null;
  }

  async attachAssets(assetIds: string[], messageId: string) {
    if (assetIds.length === 0) return;
    await this.exec(
      `UPDATE generated_assets SET message_id = ? WHERE id IN (${assetIds.map(() => "?").join(",")})`,
      [messageId, ...assetIds],
    );
  }

  async saveItem(item: SavedItem) {
    await this.exec(
      "INSERT INTO saved_items (id, user_id, message_id, label, created_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE label = VALUES(label)",
      [item.id, item.userId, item.messageId, item.label, toDate(item.createdAt)],
    );
  }

  async removeSavedItem(userId: string, messageId: string) {
    await this.exec("DELETE FROM saved_items WHERE user_id = ? AND message_id = ?", [userId, messageId]);
  }

  async stats(userId: string): Promise<HistoryStats> {
    const byType = { ask: 0, solve: 0, code: 0, file: 0, image: 0 };
    const typeRows = await this.rows<{ type: keyof typeof byType; n: number }>(
      "SELECT type, COUNT(*) AS n FROM messages WHERE user_id = ? GROUP BY type",
      [userId],
    );
    let total = 0;
    for (const r of typeRows) {
      byType[r.type] = Number(r.n);
      total += Number(r.n);
    }
    const [assets] = await this.rows<{ files: number; images: number }>(
      `SELECT SUM(kind = 'file') AS files, SUM(kind = 'image' AND name LIKE 'edited%') AS images
       FROM generated_assets WHERE user_id = ?`,
      [userId],
    );
    const [saved] = await this.rows<{ n: number }>("SELECT COUNT(*) AS n FROM saved_items WHERE user_id = ?", [userId]);
    return {
      total,
      byType,
      filesCreated: Number(assets?.files ?? 0),
      imagesEdited: Number(assets?.images ?? 0),
      savedCount: Number(saved?.n ?? 0),
    };
  }

  async countByLanguage(userId: string) {
    const counts: Record<Language, number> = { kk: 0, ru: 0, en: 0 };
    const rows = await this.rows<{ language: Language; n: number }>(
      "SELECT language, COUNT(*) AS n FROM messages WHERE user_id = ? GROUP BY language",
      [userId],
    );
    for (const r of rows) counts[r.language] = Number(r.n);
    return counts;
  }

  async close() {
    await this.pool.end();
  }
}
