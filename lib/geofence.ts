export const DEFAULT_SESSION_RADIUS_M = 100;

export function effectiveGraceM(accuracyM: number, graceCapM: number): number {
  const acc = Number.isFinite(accuracyM) ? Math.max(accuracyM, 0) : 0;
  const cap = Number.isFinite(graceCapM) ? Math.max(graceCapM, 0) : 0;
  return Math.min(acc, cap);
}
