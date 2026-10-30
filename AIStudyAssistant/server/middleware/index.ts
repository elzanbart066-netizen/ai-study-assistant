import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { PublicUser } from "../../src/models/index.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { readSessionToken, SESSION_COOKIE } from "../lib/security.js";
import type { AuthService } from "../services/authService.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: PublicUser;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.requestId = randomUUID().slice(0, 8);
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  );
  next();
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionLoader(auth: AuthService, secret: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = readCookie(req, SESSION_COOKIE);
    const userId = token ? readSessionToken(token, secret) : null;
    if (userId) {
      req.user = await auth.getUser(userId).catch(() => undefined);
    }
    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new AppError("UNAUTHORIZED", "login required"));
    return;
  }
  next();
}

/** Same-origin check for state-changing requests (basic CSRF protection). */
export function sameOrigin(req: Request, _res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD") {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (origin && req.headers.host && new URL(origin).host !== req.headers.host) {
    next(new AppError("FORBIDDEN", "origin"));
    return;
  }
  next();
}

/** Fixed-window rate limiter kept in memory, keyed by user or IP. */
export function rateLimit(name: string, limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${name}:${req.user?.id ?? req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      next();
      return;
    }
    entry.count++;
    if (entry.count > limit) {
      next(new AppError("RATE_LIMITED", name));
      return;
    }
    next();
  };
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const known = error instanceof AppError;
  const parseError = (error as { type?: string }).type === "entity.too.large";
  const appError = known
    ? error
    : parseError
      ? new AppError("FILE_INVALID", "size")
      : new AppError("INTERNAL", "unexpected");
  const entry = { module: "http", requestId: req.requestId, code: appError.code, path: req.path, method: req.method };
  if (appError.status >= 500) {
    logger.error(known ? appError.message : String((error as Error)?.stack ?? error), entry);
  } else if (appError.code === "FORBIDDEN") {
    logger.warn("access denied", { ...entry, userId: req.user?.id });
  }
  res.status(appError.status).json({
    error: { code: appError.code, reason: appError.message, field: appError.field, requestId: req.requestId },
  });
}
