
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env at the project root and fill it in.`
    );
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),

  databaseUrl: required("DATABASE_URL"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  },

  google: {
    clientId: optional("GOOGLE_CLIENT_ID"),
    clientSecret: optional("GOOGLE_CLIENT_SECRET"),
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback",
  },

  collegeDomain: process.env.COLLEGE_DOMAIN ?? "pesu.pes.edu",

  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",

  faceService: {
    url: optional("FACE_SERVICE_URL"),
    token: optional("FACE_SERVICE_TOKEN"),
  },

} as const;

export type AppConfig = typeof config;
