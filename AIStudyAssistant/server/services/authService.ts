import type { Language, PublicUser, User } from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import { newId, nowIso } from "../lib/ids.js";
import { hashPassword, verifyPassword } from "../lib/security.js";
import {
  validateEmail,
  validateLanguage,
  validateName,
  validatePassword,
} from "../lib/validation.js";
import type { DataStore } from "../repositories/types.js";

export interface RegisterInput {
  name: unknown;
  email: unknown;
  password: unknown;
  passwordConfirm?: unknown;
  language?: unknown;
}

export class AuthService {
  constructor(private store: DataStore) {}

  async register(input: RegisterInput): Promise<PublicUser> {
    const name = validateName(input.name);
    const email = validateEmail(input.email);
    const password = validatePassword(input.password, input.passwordConfirm);
    const language: Language = input.language ? validateLanguage(input.language) : "kk";
    if (await this.store.findUserByEmail(email)) {
      throw new AppError("EMAIL_TAKEN", "email", "email");
    }
    const user: User = {
      id: newId(),
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "student",
      createdAt: nowIso(),
    };
    await this.store.createUser(user, { userId: user.id, language, saveHistory: true });
    return this.toPublic(user);
  }

  async login(emailInput: unknown, passwordInput: unknown): Promise<PublicUser> {
    const email = typeof emailInput === "string" ? emailInput.trim().toLowerCase() : "";
    const password = typeof passwordInput === "string" ? passwordInput : "";
    const user = email ? await this.store.findUserByEmail(email) : null;
    // Same error for unknown email and wrong password, so accounts can't be probed.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError("INVALID_CREDENTIALS", "credentials");
    }
    return this.toPublic(user);
  }

  async getUser(id: string): Promise<PublicUser> {
    const user = await this.store.findUserById(id);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "session");
    }
    return this.toPublic(user);
  }

  async updateProfile(userId: string, input: { name?: unknown; saveHistory?: unknown }): Promise<PublicUser> {
    if (input.name !== undefined) {
      await this.store.updateUserName(userId, validateName(input.name));
    }
    if (input.saveHistory !== undefined) {
      if (typeof input.saveHistory !== "boolean") throw new AppError("VALIDATION", "saveHistory", "saveHistory");
      await this.store.updateSettings(userId, { saveHistory: input.saveHistory });
    }
    return this.getUser(userId);
  }

  async setLanguage(userId: string, language: unknown): Promise<PublicUser> {
    await this.store.updateSettings(userId, { language: validateLanguage(language) });
    return this.getUser(userId);
  }

  private async toPublic(user: User): Promise<PublicUser> {
    const settings = await this.store.getSettings(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      language: settings?.language ?? "kk",
      saveHistory: settings?.saveHistory ?? true,
    };
  }
}
