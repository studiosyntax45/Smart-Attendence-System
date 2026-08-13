
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";

export const gpsSettingsRouter = Router();

gpsSettingsRouter.use(requireAuth);

gpsSettingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const row = await prisma.gpsSettings.findUnique({ where: { id: true } });
    res.json({
      settings: row ?? {
        accuracyGraceM: 25,
        lateAfterMin: 10,
        highAccuracy: true,
      },
    });
  })
);

const updateSchema = z.object({
  accuracyGraceM: z.number().int().min(0).max(500),
  lateAfterMin: z.number().int().min(0).max(240),
  highAccuracy: z.boolean(),
});

gpsSettingsRouter.put(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const me = req.user!;
    const row = await prisma.gpsSettings.upsert({
      where: { id: true },
      create: { ...data, updatedBy: me.id },
      update: { ...data, updatedBy: me.id, updatedAt: new Date() },
    });
    res.json({ settings: row });
  })
);
