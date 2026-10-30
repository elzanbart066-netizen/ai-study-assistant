// Shared domain models used by both the web client and the API server.

export const LANGUAGES = ["kk", "ru", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const TOOL_TYPES = ["ask", "solve", "code", "file", "image"] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

export type Role = "student" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  language: Language;
  saveHistory: boolean;
}

export interface UserSettings {
  userId: string;
  language: Language;
  saveHistory: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
}

export type MessageStatus = "done" | "failed";

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  type: ToolType;
  prompt: string;
  /** JSON-encoded tool result (see the *Result interfaces below). */
  answer: string;
  status: MessageStatus;
  language: Language;
  createdAt: string;
}

export interface Source {
  id: string;
  messageId: string;
  title: string;
  url: string;
  domain: string;
  retrievedAt: string;
}

export type AssetKind = "file" | "image";

export interface GeneratedAsset {
  id: string;
  userId: string;
  messageId: string | null;
  kind: AssetKind;
  format: string;
  name: string;
  size: number;
  filePath: string;
  createdAt: string;
}

export interface SavedItem {
  id: string;
  userId: string;
  messageId: string;
  label: string;
  createdAt: string;
}

/** Where an answer came from: a configured AI model or the built-in offline tools. */
export type Provider = "ai" | "offline";

export interface SourceLink {
  title: string;
  url: string;
  domain: string;
}

export interface AskResult {
  summary: string;
  explanation: string;
  example: string;
  sources: SourceLink[];
  uncertainty: string;
  usedWebSearch: boolean;
  provider: Provider;
  license?: string;
}

export interface SolveResult {
  given: string;
  method: string;
  steps: string[];
  answer: string;
  check: string;
  table?: { headers: string[]; rows: string[][] };
  provider: Provider;
}

export const CODE_LANGUAGES = ["python", "javascript", "java", "cpp", "csharp"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export interface CodeResult {
  language: CodeLanguage;
  code: string;
  explanation: string;
  sampleInput: string;
  sampleOutput: string;
  provider: Provider;
}

export const FILE_FORMATS = ["docx", "pdf", "pptx", "txt"] as const;
export type FileFormat = (typeof FILE_FORMATS)[number];

export interface DocSection {
  heading: string;
  paragraphs: string[];
}

export interface FileResult {
  assetId: string;
  name: string;
  format: FileFormat;
  title: string;
  sections: DocSection[];
  sources: SourceLink[];
  provider: Provider;
}

export interface ImageResult {
  originalAssetId: string;
  editedAssetId: string;
  operations: string[];
  format: string;
}

export interface HistoryEntry {
  id: string;
  conversationId: string;
  type: ToolType;
  prompt: string;
  status: MessageStatus;
  language: Language;
  createdAt: string;
  saved: boolean;
  sourceCount: number;
}

export interface HistoryStats {
  total: number;
  byType: Record<ToolType, number>;
  filesCreated: number;
  imagesEdited: number;
  savedCount: number;
}
