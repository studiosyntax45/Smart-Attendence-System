
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, forbidden } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";

export const geofenceRouter = Router();

geofenceRouter.use(requireAuth);
geofenceRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const geofences = await prisma.geofence.findMany({ orderBy: { roomName: "asc" } });
    res.json({ geofences });
  })
);
geofenceRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        roomName: z.string().min(1).max(120),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusM: z.number().int().min(5).max(2000),
      })
      .parse(req.body);
    const geofence = await prisma.geofence.create({
      data: {
        roomName: data.roomName,
        lat: data.lat,
        lng: data.lng,
        radiusM: data.radiusM,
      },
    });
    res.status(201).json({ geofence });
  })
);
geofenceRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        roomName: z.string().min(1).max(120).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        radiusM: z.number().int().min(5).max(2000).optional(),
      })
      .parse(req.body);
    const geofence = await prisma.geofence.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ geofence });
  })
);
geofenceRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const used = await prisma.session.count({ where: { geofenceId: req.params.id } });
    if (used > 0) {
      throw badRequest(
        "This geofence has sessions attached and cannot be deleted (history would be lost)."
      );
    }
    await prisma.geofence.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
