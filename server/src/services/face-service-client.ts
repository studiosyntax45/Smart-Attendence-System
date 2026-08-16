
import { config } from "../config/env";

export const FACE_SERVICE_TIMEOUT_MS = 20_000;

export type Fetcher = typeof fetch;

export interface FaceServiceConfig {
  baseUrl: string;
  token: string | null;
  timeoutMs: number;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; reason: string };

export interface RepresentData {
  embedding: number[];
  dims?: number;
  model?: string;
}

export interface VerifyData {
  verified: boolean;
  distance: number;
  threshold?: number;
  model?: string;
  metric?: string;
  dims?: number;
}

export function faceServiceConfigured(): boolean {
  return !!config.faceService.url;
}

export function readFaceServiceConfig(): FaceServiceConfig | null {
  const baseUrl = config.faceService.url;
  if (!baseUrl) return null;
  return { baseUrl, token: config.faceService.token ?? null, timeoutMs: FACE_SERVICE_TIMEOUT_MS };
}

export function buildServiceUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function serviceHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Face-Service-Token"] = token;
  return headers;
}

export function isValidServerEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}

async function postJson<T>(
  path: string,
  payload: unknown,
  validate: (b: unknown) => b is T,
  config: FaceServiceConfig,
  fetchImpl: Fetcher = fetch
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetchImpl(buildServiceUrl(config.baseUrl, path), {
      method: "POST",
      headers: serviceHeaders(config.token),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.status >= 200 && res.status < 300) {
      if (validate(body)) return { ok: true, data: body };
      return { ok: false, status: 502, reason: "Face service returned an unexpected response." };
    }
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : undefined;
    return { ok: false, status: res.status, reason: detail || `Face service error (${res.status}).` };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      reason: aborted ? "Face service timed out — please try again." : "Could not reach the face service.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function isRepresentData(b: unknown): b is RepresentData {
  return (
    !!b &&
    typeof b === "object" &&
    Array.isArray((b as RepresentData).embedding) &&
    (b as RepresentData).embedding.every((x) => typeof x === "number" && Number.isFinite(x)) &&
    (b as RepresentData).embedding.length > 0
  );
}

function isVerifyData(b: unknown): b is VerifyData {
  return (
    !!b &&
    typeof b === "object" &&
    typeof (b as VerifyData).verified === "boolean" &&
    typeof (b as VerifyData).distance === "number"
  );
}

export async function representFace(
  image: string,
  opts: { config?: FaceServiceConfig | null; fetchImpl?: Fetcher } = {}
): Promise<ServiceResult<RepresentData>> {
  const cfg = opts.config ?? readFaceServiceConfig();
  if (!cfg) return { ok: false, status: 501, reason: "Face service is not configured." };
  return postJson("/represent", { image }, isRepresentData, cfg, opts.fetchImpl);
}

export async function verifyFace(
  input: { image: string; referenceEmbedding: number[] },
  opts: { config?: FaceServiceConfig | null; fetchImpl?: Fetcher } = {}
): Promise<ServiceResult<VerifyData>> {
  const cfg = opts.config ?? readFaceServiceConfig();
  if (!cfg) return { ok: false, status: 501, reason: "Face service is not configured." };
  return postJson(
    "/verify",
    { image: input.image, reference_embedding: input.referenceEmbedding },
    isVerifyData,
    cfg,
    opts.fetchImpl
  );
}
