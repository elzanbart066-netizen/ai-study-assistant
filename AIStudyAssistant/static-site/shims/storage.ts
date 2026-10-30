import { Buffer } from "buffer";
import { AppError } from "../../server/lib/errors.js";

const TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain;charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/** Asset id -> object URL, so pages can show images and offer downloads. */
export const assetUrls = new Map<string, string>();

/** In-memory replacement for the server's file storage. */
export class FileStorage {
  private files = new Map<string, Buffer>();

  constructor(_root?: string) {}

  async write(userId: string, fileName: string, data: Buffer): Promise<string> {
    const relative = `${userId}/${fileName}`;
    this.files.set(relative, data);
    const dot = fileName.lastIndexOf(".");
    const id = fileName.slice(0, dot);
    const type = TYPES[fileName.slice(dot + 1)] ?? "application/octet-stream";
    assetUrls.set(id, URL.createObjectURL(new Blob([new Uint8Array(data)], { type })));
    return relative;
  }

  async read(relative: string): Promise<Buffer> {
    const data = this.files.get(relative);
    if (!data) throw new AppError("NOT_FOUND", "file");
    return data;
  }

  async remove(relative: string): Promise<void> {
    this.files.delete(relative);
    const name = relative.split("/").pop() ?? "";
    const id = name.slice(0, name.lastIndexOf("."));
    const url = assetUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    assetUrls.delete(id);
  }
}
