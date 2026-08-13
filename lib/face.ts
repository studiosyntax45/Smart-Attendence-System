

export const DESCRIPTOR_LENGTH = 128;


export const FACE_MATCH_THRESHOLD = 0.9;


export type FaceDescriptor = number[];


export function euclideanDistance(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  if (a.length !== b.length) {
    throw new Error(
      `descriptor length mismatch: ${a.length} vs ${b.length}`
    );
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}


export function isFaceMatch(
  distance: number,
  threshold: number = FACE_MATCH_THRESHOLD
): boolean {
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

export interface Point {
  x: number;
  y: number;
}


export const BLINK_EAR_THRESHOLD = 0.22;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}


export function eyeAspectRatio(eye: Point[]): number {
  if (eye.length !== 6) {
    throw new Error(`expected 6 eye points, got ${eye.length}`);
  }
  const horizontal = dist(eye[0], eye[3]);
  if (horizontal === 0) return 0;
  const vertical = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  return vertical / (2 * horizontal);
}


export function blinkRatio(left: Point[], right: Point[]): number {
  return (eyeAspectRatio(left) + eyeAspectRatio(right)) / 2;
}

export interface BlinkState {
  
  baseline: number;
  
  closed: boolean;
  
  count: number;
}


export const BLINK_CLOSE_FRACTION = 0.75;

export const BLINK_OPEN_FRACTION = 0.85;

const BASELINE_DECAY = 0.98;


export function initBlinkState(): BlinkState {
  return { baseline: 0, closed: false, count: 0 };
}


export function updateBlinkState(state: BlinkState, ear: number): BlinkState {
  if (!Number.isFinite(ear) || ear <= 0) return state;
  const baseline =
    state.baseline === 0 ? ear : Math.max(ear, state.baseline * BASELINE_DECAY);

  const closeAt = baseline * BLINK_CLOSE_FRACTION;
  const openAt = baseline * BLINK_OPEN_FRACTION;

  let { closed, count } = state;
  if (!closed && ear < closeAt) {
    closed = true;
  } else if (closed && ear > openAt) {
    closed = false;
    count += 1;
  }
  return { baseline, closed, count };
}
