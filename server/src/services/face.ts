
export const DESCRIPTOR_LENGTH = 128;
export const FACE_MATCH_THRESHOLD = 0.9;

export type FaceDescriptor = number[];

export function euclideanDistance(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  if (a.length !== b.length) {
    throw new Error(`descriptor length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isFaceMatch(distance: number, threshold = FACE_MATCH_THRESHOLD): boolean {
  return distance <= threshold;
}

export function matchConfidence(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}

export function serializeDescriptor(d: ArrayLike<number>): FaceDescriptor {
  return Array.from(d, (x) => Number(x));
}

export function isValidDescriptor(value: unknown): value is FaceDescriptor {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}
