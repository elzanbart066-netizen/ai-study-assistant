import type {
  DocSection,
  FileFormat,
  FileResult,
  GeneratedAsset,
  ImageResult,
  Language,
  SourceLink,
} from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import { newId, nowIso } from "../lib/ids.js";
import type { FileStorage } from "../lib/storage.js";
import { decodeImage } from "../lib/validation.js";
import type { AIProvider } from "../integrations/ai.js";
import { buildDocument } from "../integrations/documents.js";
import type { DataStore } from "../repositories/types.js";
import type { HistoryService } from "./historyService.js";
import { fileSystem, parseSections, splitLines } from "./prompts.js";
import { SearchService, sentences } from "./searchService.js";

const SOURCES_HEADING: Record<Language, string> = {
  kk: "Пайдаланылған дереккөздер",
  ru: "Использованные источники",
  en: "Sources",
};

const ALLOWED_OPERATIONS = new Set([
  "crop",
  "rotate",
  "flip",
  "brightness",
  "contrast",
  "saturation",
  "grayscale",
  "sepia",
  "invert",
  "blur",
  "background",
  "text",
  "resize",
  "recolor",
]);

export interface CreateFileInput {
  userId: string;
  title: string;
  instruction: string;
  format: FileFormat;
  language: Language;
  requestId?: string;
}

export class MediaService {
  constructor(
    private store: DataStore,
    private storage: FileStorage,
    private history: HistoryService,
    private ai: AIProvider,
    private search: SearchService,
  ) {}

  private async writeContent(input: CreateFileInput): Promise<{ sections: DocSection[]; sources: SourceLink[]; provider: "ai" | "offline" }> {
    if (this.ai.available) {
      const response = await this.ai.complete({
        system: fileSystem(input.language),
        prompt: `Title: ${input.title}\nInstruction: ${input.instruction}`,
        webSearch: this.search.available,
        requestId: input.requestId,
      });
      const sections: DocSection[] = [];
      for (const [key, body] of parseSections(response.text)) {
        if (key.startsWith("SECTION:")) {
          sections.push({ heading: key.slice("SECTION:".length).trim(), paragraphs: splitLines(body) });
        }
      }
      if (sections.length === 0) {
        sections.push({ heading: input.title, paragraphs: splitLines(response.text) });
      }
      return { sections, sources: response.citations, provider: "ai" };
    }
    const hits = await this.search.find(input.instruction, input.language, 4);
    const sections = hits.map((h) => {
      const parts = sentences(h.extract);
      const paragraphs: string[] = [];
      for (let i = 0; i < Math.min(parts.length, 12); i += 3) paragraphs.push(parts.slice(i, i + 3).join(" "));
      return { heading: h.title, paragraphs };
    });
    return { sections, sources: SearchService.toLinks(hits), provider: "offline" };
  }

  async createFile(input: CreateFileInput): Promise<{ result: FileResult; messageId: string | null }> {
    const content = await this.writeContent(input);
    const buffer = await buildDocument(input.format, {
      title: input.title,
      sections: content.sections,
      sources: content.sources,
      sourcesHeading: SOURCES_HEADING[input.language],
    });
    const assetId = newId();
    const name = `${input.title}.${input.format}`;
    const filePath = await this.storage.write(input.userId, `${assetId}.${input.format}`, buffer);
    const result: FileResult = {
      assetId,
      name,
      format: input.format,
      title: input.title,
      sections: content.sections,
      sources: content.sources,
      provider: content.provider,
    };
    try {
      const asset: GeneratedAsset = {
        id: assetId,
        userId: input.userId,
        messageId: null,
        kind: "file",
        format: input.format,
        name,
        size: buffer.length,
        filePath,
        createdAt: nowIso(),
      };
      await this.store.createAssets([asset]);
      const saved = await this.history.record({
        userId: input.userId,
        type: "file",
        prompt: `${input.title} — ${input.instruction}`,
        answer: result,
        language: input.language,
        sources: content.sources,
      });
      if (saved) await this.store.attachAssets([assetId], saved.messageId);
      return { result, messageId: saved?.messageId ?? null };
    } catch (error) {
      // Keep the file system and the database consistent.
      await this.storage.remove(filePath);
      throw error;
    }
  }

  async saveEditedImage(input: {
    userId: string;
    original: unknown;
    edited: unknown;
    operations: unknown;
    instruction: unknown;
    language: Language;
    maxBytes: number;
  }): Promise<{ result: ImageResult; messageId: string | null }> {
    const original = decodeImage(input.original, input.maxBytes);
    const edited = decodeImage(input.edited, input.maxBytes);
    const operations = Array.isArray(input.operations)
      ? input.operations.filter((o): o is string => typeof o === "string" && ALLOWED_OPERATIONS.has(o)).slice(0, 20)
      : [];
    if (operations.length === 0) {
      throw new AppError("IMAGE_INVALID", "operations", "operations");
    }
    const instruction = typeof input.instruction === "string" ? input.instruction.trim().slice(0, 500) : "";
    const originalId = newId();
    const editedId = newId();
    const originalPath = await this.storage.write(input.userId, `${originalId}.${original.format}`, original.buffer);
    const editedPath = await this.storage.write(input.userId, `${editedId}.${edited.format}`, edited.buffer);
    const createdAt = nowIso();
    const assets: GeneratedAsset[] = [
      { id: originalId, userId: input.userId, messageId: null, kind: "image", format: original.format, name: `original.${original.format}`, size: original.buffer.length, filePath: originalPath, createdAt },
      { id: editedId, userId: input.userId, messageId: null, kind: "image", format: edited.format, name: `edited.${edited.format}`, size: edited.buffer.length, filePath: editedPath, createdAt },
    ];
    const result: ImageResult = { originalAssetId: originalId, editedAssetId: editedId, operations, format: edited.format };
    try {
      await this.store.createAssets(assets);
      const saved = await this.history.record({
        userId: input.userId,
        type: "image",
        prompt: instruction || operations.join(", "),
        answer: result,
        language: input.language,
      });
      if (saved) await this.store.attachAssets([originalId, editedId], saved.messageId);
      return { result, messageId: saved?.messageId ?? null };
    } catch (error) {
      await Promise.all([this.storage.remove(originalPath), this.storage.remove(editedPath)]);
      throw error;
    }
  }

  async readAsset(userId: string, id: string) {
    const asset = await this.store.findAsset(id);
    if (!asset) throw new AppError("NOT_FOUND", "asset");
    if (asset.userId !== userId) throw new AppError("FORBIDDEN", "asset");
    return { asset, data: await this.storage.read(asset.filePath) };
  }
}
