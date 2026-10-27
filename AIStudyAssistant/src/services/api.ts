// Thin fetch wrapper: JSON in/out, cookies for the session, typed errors.

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
  let response: Response;
  try {
    response = await fetch(`/api${url}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK", 0);
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as {
    error?: { code: string; reason?: string; field?: string; requestId?: string };
  };
  if (!response.ok) {
    const e = data.error;
    throw new ApiError(e?.code ?? "INTERNAL", response.status, e?.reason, e?.field, e?.requestId);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body ?? {}),
  del: <T>(url: string) => request<T>("DELETE", url),
};

export const assetUrl = (id: string, inline = false) => `/api/assets/${id}${inline ? "?inline=1" : ""}`;
