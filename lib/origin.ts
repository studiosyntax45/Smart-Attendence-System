
export function resolveOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}