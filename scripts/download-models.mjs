
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE =
  "https://raw.githubusercontent.com/vladmandic/face-api/master/model";
const FILES = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model.bin",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin",
];

const outDir = path.join(process.cwd(), "public", "models");
await mkdir(outDir, { recursive: true });

for (const file of FILES) {
  const url = `${BASE}/${file}`;
  process.stdout.write(`â†“ ${file} ... `);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAILED (${res.status}) â€” ${url}`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(outDir, file), buf);
  console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`);
}

console.log(`\nModels saved to ${outDir}`);
