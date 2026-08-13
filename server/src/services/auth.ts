
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { config } from "../config/env";
import { prisma } from "../config/db";

const BCRYPT_ROUNDS = 12;

export type Role = "student" | "faculty" | "admin";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  fullName: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  exp?: number;
}

const revokedRefreshJtis = new Set<string>();
let _dbCacheLoaded = false;

async function ensureDbCacheLoaded(): Promise<void> {
  if (_dbCacheLoaded) return;
  _dbCacheLoaded = true;
  try {
    const rows = await prisma.revokedToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { jti: true },
    });
    for (const r of rows) revokedRefreshJtis.add(r.jti);
  } catch {
    _dbCacheLoaded = false;
  }
}

export async function revokeRefreshToken(jti: string, expiresAt?: Date): Promise<void> {
  const expiry = expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  revokedRefreshJtis.add(jti);
  try {
    await prisma.revokedToken.upsert({
      where: { jti },
      create: { jti, expiresAt: expiry },
      update: { expiresAt: expiry },
    });
  } catch {}
}

export async function pruneExpiredRevokedTokens(): Promise<void> {
  try {
    await prisma.revokedToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {}
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, jti } as RefreshTokenPayload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl as jwt.SignOptions["expiresIn"],
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const decoded = jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;

  await ensureDbCacheLoaded();

  if (revokedRefreshJtis.has(decoded.jti)) {
    throw new Error("Refresh token revoked");
  }

  try {
    const dbRow = await prisma.revokedToken.findUnique({
      where: { jti: decoded.jti },
    });
    if (dbRow) {
      revokedRefreshJtis.add(decoded.jti);
      throw new Error("Refresh token revoked");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Refresh token revoked") throw err;
  }

  return decoded;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}


export async function getUserWithProfile(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.authUser.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.profile.role as Role,
    fullName: user.profile.fullName,
  };
}

export function isCollegeEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain === config.collegeDomain.toLowerCase();
}
