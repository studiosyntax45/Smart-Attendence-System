import "./env";
import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    // Errors are thrown; the error handler logs the unhandled ones. Logging here too
    // printed a stack for every expected duplicate (P2002) that routes turn into a 409.
    log: ["warn"],
  });

global.__prisma = prisma;