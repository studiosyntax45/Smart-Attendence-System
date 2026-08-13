
import type { NextFunction, Request, Response } from "express";
import { getUserWithProfile, verifyAccessToken, type AuthenticatedUser, type Role } from "../services/auth";

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}


function unauthorized(res: Response, message = "Not signed in."): void {
  res.status(401).json({ error: message });
}

function forbidden(res: Response, message = "Access denied."): void {
  res.status(403).json({ error: message });
}


export function extractToken(req: Request): string | null {
  const header = req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  if (typeof req.query.token === "string") return req.query.token;
  return null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (!token) return unauthorized(res);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return unauthorized(res, "Session expired ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â please sign in again.");
  }

  const user = await getUserWithProfile(payload.sub);
  if (!user) return unauthorized(res, "Account no longer exists.");

  req.user = user;
  next();
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) return unauthorized(res);
    if (!allowed.includes(req.user.role)) {
      return forbidden(res, "You don't have permission for this action.");
    }
    next();
  };
}


export async function tryAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await getUserWithProfile(payload.sub);
    if (user) req.user = user;
  } catch {
  }
  next();
}
