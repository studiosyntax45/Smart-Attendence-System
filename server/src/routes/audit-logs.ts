import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { dayEnd, dayStart } from "../services/dates";

export const auditLogRouter = Router();
auditLogRouter.use(requireAuth);

auditLogRouter.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const q = req.query;
    const str = (k: string) => (typeof q[k] === "string" && q[k] !== "" ? (q[k] as string) : undefined);

    const from = str("from");
    const to = str("to");
    const take = Math.min(Number(str("limit") ?? 100) || 100, 500);

    const rows = await prisma.auditLog.findMany({
      where: {
        ...(str("actorId") ? { actorId: str("actorId") } : {}),
        ...(str("role") ? { actorRole: str("role") } : {}),
        ...(str("action") ? { action: str("action") } : {}),
        ...(str("entity") ? { entity: str("entity") } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: dayStart(from) } : {}),
                ...(to ? { lte: dayEnd(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: { actor: { select: { fullName: true, rollNo: true } } },
    });

    const [actions, entities] = await Promise.all([
      prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
      prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    ]);

    res.json({
      logs: rows,
      actions: actions.map((a) => a.action),
      entities: entities.map((e) => e.entity),
    });
  })
);
