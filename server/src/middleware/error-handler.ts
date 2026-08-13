
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message ?? "Invalid input.",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e?.code === "P2002") {
    const target = Array.isArray(e.meta?.target) ? e.meta?.target.join(", ") : e.meta?.target;
    res.status(409).json({ error: `Already exists (${target ?? "unique constraint"}).` });
    return;
  }
  if (e?.code === "P2025") {
    res.status(404).json({ error: "Record not found." });
    return;
  }
  if (e?.code === "P2003") {
    res.status(409).json({ error: "Referenced record is in use and cannot be modified." });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Server error." });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = "Not signed in.") => new HttpError(401, msg);
export const forbidden = (msg = "Access denied.") => new HttpError(403, msg);
export const notFound = (msg = "Not found.") => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
