
import type { Role } from "./utils";

export const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ??
  "http://localhost:4000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

interface ApiOptions {
  
  skipAuth?: boolean;
  
  form?: boolean;
}

let refreshInflight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = (await res.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiOptions = {},
  retried = false
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;

  if (body !== undefined) {
    if (options.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      payload = new URLSearchParams(body as Record<string, string>).toString();
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }
  if (!options.skipAuth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: "include",
      body: payload,
    });
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : "Network error");
  }
  if (res.status === 401 && !options.skipAuth && !retried && path !== "/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(method, path, body, options, true);
    }
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => request<T>("GET", path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>("POST", path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>("PATCH", path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>("PUT", path, body, opts),
  del: <T>(path: string, opts?: ApiOptions) => request<T>("DELETE", path, undefined, opts),
};

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

export interface AuthResult {
  user: SessionUser;
  accessToken: string;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await request<AuthResult>("POST", "/auth/login", { email, password }, { skipAuth: true });
  setAccessToken(res.accessToken);
  return res;
}

export async function register(email: string, password: string, fullName: string): Promise<AuthResult> {
  const res = await request<AuthResult>("POST", "/auth/register", { email, password, fullName }, { skipAuth: true });
  setAccessToken(res.accessToken);
  return res;
}

export async function logout(): Promise<void> {
  try {
    await request<void>("POST", "/auth/logout", undefined, { skipAuth: true });
  } finally {
    setAccessToken(null);
  }
}

export async function refreshBootstrap(): Promise<SessionUser | null> {
  const ok = await refreshAccessToken();
  if (!ok) return null;
  return me();
}

export async function me(): Promise<SessionUser | null> {
  try {
    const res = await request<{ user: SessionUser }>("GET", "/auth/me");
    return res.user;
  } catch {
    return null;
  }
}


export function googleOAuthUrl(opts: { parentView?: boolean } = {}): string {
  const qs = opts.parentView ? "?parentView=1" : "";
  return `${API_BASE_URL}/auth/google${qs}`;
}
