// Replaces src/services/api.ts in the browser-only build: same exports, but
// requests go to the in-page backend instead of the network.
import { handle } from "./backend.js";
import { assetUrls } from "./shims/storage.js";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly reason?: string,
    readonly field?: string,
    readonly requestId?: string,
  ) {
    super(code);
  }
}

export async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  try {
    // A JSON round trip keeps the same copy semantics as HTTP.
    const payload = body === undefined ? undefined : JSON.parse(JSON.stringify(body));
    const reply = await handle(method, url, payload);
    return (reply.data === undefined ? undefined : JSON.parse(JSON.stringify(reply.data))) as T;
  } catch (error) {
    const e = error as { code?: string; status?: number; message?: string; field?: string };
    if (e && typeof e.code === "string" && typeof e.status === "number") {
      throw new ApiError(e.code, e.status, e.message, e.field);
    }
    console.error(error);
    throw new ApiError("INTERNAL", 500);
  }
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body ?? {}),
  del: <T>(url: string) => request<T>("DELETE", url),
};

export const assetUrl = (id: string, _inline = false) => assetUrls.get(id) ?? "";
