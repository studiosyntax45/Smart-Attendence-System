
import type { Point } from "./face.ts";

type FaceApi = typeof import("@vladmandic/face-api");

let faceapiPromise: Promise<FaceApi> | null = null;
let modelsPromise: Promise<void> | null = null;


export async function loadFaceModels(): Promise<FaceApi> {
  if (!faceapiPromise) faceapiPromise = import("@vladmandic/face-api");
  const faceapi = await faceapiPromise;
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]).then(() => undefined);
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
