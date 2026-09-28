import type { Point } from "./face.ts";

type FaceApi = typeof import("@vladmandic/face-api");

let faceapiPromise: Promise<FaceApi> | null = null;
let modelsPromise: Promise<void> | null = null;

/** Thrown when /models is missing, so the UI can tell that apart from an engine failure. */
export class FaceModelsMissingError extends Error {}

/**
 * WebGL is fastest. Without it (hardware acceleration off, remote desktop, blocklisted
 * driver) tfjs would try its wasm backend, whose .wasm files this app does not serve,
 * so fall back straight to the CPU backend, which is slower but always works.
 */
async function pickBackend(faceapi: FaceApi): Promise<void> {
  // face-api's bundled tfjs typings omit these, but they exist at runtime.
  const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
  try {
    if (await tf.setBackend("webgl")) {
      await tf.ready();
      return;
    }
  } catch {
    // fall through to cpu
  }
  await tf.setBackend("cpu");
  await tf.ready();
}

async function modelsPresent(): Promise<boolean> {
  try {
    const res = await fetch("/models/tiny_face_detector_model-weights_manifest.json", { cache: "no-store" });
    return res.ok && (res.headers.get("content-type") ?? "").includes("json");
  } catch {
    return false;
  }
}

export async function loadFaceModels(): Promise<FaceApi> {
  if (!faceapiPromise) faceapiPromise = import("@vladmandic/face-api");
  const faceapi = await faceapiPromise;
  if (!modelsPromise) {
    modelsPromise = (async () => {
      if (!(await modelsPresent())) throw new FaceModelsMissingError("Face models are not downloaded.");
      await pickBackend(faceapi);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
    })().catch((err) => {
      modelsPromise = null; // let the next attempt retry instead of caching the failure
      throw err;
    });
  }
  await modelsPromise;
  return faceapi;
}

export interface FaceReading {

  score: number;

  descriptor: Float32Array | null;

  leftEye: Point[];
  rightEye: Point[];
}

const toPoints = (pts: { x: number; y: number }[]): Point[] =>
  pts.map((p) => ({ x: p.x, y: p.y }));

function detectorOptions(faceapi: FaceApi) {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.3,
  });
}

export async function detectFaceLandmarks(
  faceapi: FaceApi,
  video: HTMLVideoElement
): Promise<FaceReading | null> {
  const result = await faceapi
    .detectSingleFace(video, detectorOptions(faceapi))
    .withFaceLandmarks();

  if (!result) return null;

  return {
    score: result.detection.score,
    descriptor: null,
    leftEye: toPoints(result.landmarks.getLeftEye()),
    rightEye: toPoints(result.landmarks.getRightEye()),
  };
}

export async function detectFace(
  faceapi: FaceApi,
  video: HTMLVideoElement
): Promise<FaceReading | null> {
  const result = await faceapi
    .detectSingleFace(video, detectorOptions(faceapi))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  return {
    score: result.detection.score,
    descriptor: result.descriptor,
    leftEye: toPoints(result.landmarks.getLeftEye()),
    rightEye: toPoints(result.landmarks.getRightEye()),
  };
}
