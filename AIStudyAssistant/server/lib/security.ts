import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/** Hashes a password with scrypt and a random salt: "scrypt$<salt>$<hash>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) {
    return false;
  }
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + SESSION_TTL_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string, secret: string, now = Date.now()): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      uid?: string;
      exp?: number;
    };
    if (!data.uid || !data.exp || data.exp < now) {
      return null;
    }
    return data.uid;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "sid";
export const SESSION_MAX_AGE_MS = SESSION_TTL_MS;
