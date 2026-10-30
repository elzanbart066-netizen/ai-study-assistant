import {
  CODE_LANGUAGES,
  type CodeLanguage,
  FILE_FORMATS,
  type FileFormat,
  LANGUAGES,
  type Language,
  TOOL_TYPES,
  type ToolType,
} from "../../src/models/index.js";
import { AppError } from "./errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateName(value: unknown): string {
  const name = str(value);
  if (name.length < 2 || name.length > 80) {
    throw new AppError("VALIDATION", "name", "name");
  }
  return name;
}

export function validateEmail(value: unknown): string {
  const email = str(value).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) {
    throw new AppError("VALIDATION", "email", "email");
  }
  return email;
}

export function validatePassword(value: unknown, confirm?: unknown): string {
  const password = typeof value === "string" ? value : "";
  if (password.length < 8 || password.length > 128) {
    throw new AppError("VALIDATION", "password", "password");
  }
  if (confirm !== undefined && confirm !== password) {
    throw new AppError("VALIDATION", "passwordConfirm", "passwordConfirm");
  }
  return password;
}

export function validatePrompt(value: unknown, maxLength: number, field = "prompt"): string {
  const prompt = str(value);
  if (!prompt) {
    throw new AppError("VALIDATION", "promptEmpty", field);
  }
  if (prompt.length > maxLength) {
    throw new AppError("VALIDATION", "promptTooLong", field);
  }
  return prompt;
}

export function validateLanguage(value: unknown): Language {
  if (typeof value === "string" && (LANGUAGES as readonly string[]).includes(value)) {
    return value as Language;
  }
  throw new AppError("VALIDATION", "language", "language");
}

export function validateToolType(value: unknown): ToolType {
  if (typeof value === "string" && (TOOL_TYPES as readonly string[]).includes(value)) {
    return value as ToolType;
  }
  throw new AppError("VALIDATION", "type", "type");
}

export function validateCodeLanguage(value: unknown): CodeLanguage {
  if (typeof value === "string" && (CODE_LANGUAGES as readonly string[]).includes(value)) {
    return value as CodeLanguage;
  }
  throw new AppError("VALIDATION", "codeLanguage", "codeLanguage");
}

export function validateFileFormat(value: unknown): FileFormat {
  if (typeof value === "string" && (FILE_FORMATS as readonly string[]).includes(value)) {
    return value as FileFormat;
  }
  throw new AppError("FILE_INVALID", "format", "format");
}

export function validateTitle(value: unknown): string {
  const title = str(value).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "");
  if (!title || title.length > 120) {
    throw new AppError("VALIDATION", "title", "title");
  }
  return title;
}

const IMAGE_SIGNATURES: { format: "png" | "jpg" | "webp"; test: (b: Buffer) => boolean }[] = [
  { format: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { format: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    format: "webp",
    test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/** Decodes a data URL and checks the real file signature, not just the declared type. */
export function decodeImage(dataUrl: unknown, maxBytes: number): { buffer: Buffer; format: "png" | "jpg" | "webp" } {
  const match = typeof dataUrl === "string" ? /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!match) {
    throw new AppError("IMAGE_INVALID", "type", "image");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new AppError("IMAGE_INVALID", "size", "image");
  }
  const signature = IMAGE_SIGNATURES.find((s) => s.test(buffer));
  if (!signature) {
    throw new AppError("IMAGE_INVALID", "type", "image");
  }
  return { buffer, format: signature.format };
}
