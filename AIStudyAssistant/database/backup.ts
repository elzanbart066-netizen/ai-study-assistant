// Backup and restore for the MySQL database.
//   npm run db:backup                 -> writes backups/backup-<time>.json
//   npm run db:backup -- restore FILE -> restores that file in one transaction
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { loadConfig } from "../server/config.js";

const TABLES = ["users", "user_settings", "conversations", "messages", "sources", "generated_assets", "saved_items"];

const config = loadConfig();
const conn = await mysql.createConnection({ uri: config.mysqlUrl, charset: "utf8mb4", dateStrings: true });

try {
  if (process.argv[2] === "restore") {
    const file = process.argv[3];
    if (!file) throw new Error("Usage: npm run db:backup -- restore <file>");
    const data = JSON.parse(await readFile(file, "utf8")) as Record<string, Record<string, unknown>[]>;
    await conn.beginTransaction();
    try {
      for (const table of [...TABLES].reverse()) await conn.query(`DELETE FROM \`${table}\``);
      for (const table of TABLES) {
        for (const row of data[table] ?? []) {
          const cols = Object.keys(row);
          await conn.query(
            `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
            cols.map((c) => row[c]),
          );
        }
      }
      await conn.commit();
      console.log(`Restored ${file}`);
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } else {
    const out: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
      out[table] = rows as unknown[];
    }
    const dir = path.join(config.rootDir, "backups");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(file, JSON.stringify(out, null, 2));
    console.log(`Backup written to ${file}`);
  }
} finally {
  await conn.end();
}
