import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors.js";

/** Stores generated files under storageDir/<userId>/; paths never leave that root. */
export class FileStorage {
  constructor(private root: string) {}

  private resolve(relative: string): string {
    const full = path.resolve(this.root, relative);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new AppError("FORBIDDEN", "path");
    }
    return full;
  }

  async write(userId: string, fileName: string, data: Buffer): Promise<string> {
    const relative = path.join(userId, fileName);
    const full = this.resolve(relative);
    try {
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, data);
    } catch {
      throw new AppError("STORAGE_FAILED", "write");
    }
    return relative;
  }

  async read(relative: string): Promise<Buffer> {
    try {
      return await readFile(this.resolve(relative));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("NOT_FOUND", "file");
    }
  }

  async remove(relative: string): Promise<void> {
    await rm(this.resolve(relative), { force: true });
  }
}
