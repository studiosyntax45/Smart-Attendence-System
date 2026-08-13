
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, conflict, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { getIO } from "../sockets/index";

export const sessionRouter = Router();

sessionRouter.use(requireAuth);
sessionRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const open = req.query.open === "true";
    const facultyId = typeof req.query.facultyId === "string" ? req.query.facultyId : undefined;
    const sessions = await prisma.session.findMany({
      where: {
        ...(open ? { closedAt: null } : {}),
        ...(facultyId ? { facultyId } : {}),
      },
      orderBy: { openedAt: "desc" },
      include: { geofence: true, faculty: { select: { id: true, fullName: true } } },
    });
    res.json({ sessions });
  })
);
sessionRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { geofence: true, faculty: { select: { id: true, fullName: true } } },
    });
    if (!session) throw notFound("Session not found.");
    res.json({ session });
  })
);
const openSessionSchema = z.object({
  course: z.string().min(1).max(120),
  geofenceId: z.string().uuid(),
});
sessionRouter.post(
  "/",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const data = openSessionSchema.parse(req.body);
    const me = req.user!;

    const openInRoom = await prisma.session.count({
      where: { closedAt: null, geofenceId: data.geofenceId },
    });
    if (openInRoom > 0) {
      throw conflict(
        "Another session is already open in this room — close it before starting a new one."
      );
    }

    const session = await prisma.session.create({
      data: {
        course: data.course,
        facultyId: me.id,
        geofenceId: data.geofenceId,
      },
      include: { geofence: true, faculty: { select: { id: true, fullName: true } } },
    });

    getIO()?.to(`faculty:${me.id}`).emit("session:opened", { session });
    res.status(201).json({ session });
  })
);
sessionRouter.post(
  "/:id/close",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const existing = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Session not found.");
    if (existing.closedAt) throw badRequest("Session is already closed.");
    if (me.role === "faculty" && existing.facultyId !== me.id) throw badRequest("Not your session.");

    const closedAt = new Date();

    await prisma.$transaction([
      prisma.session.update({
        where: { id: req.params.id },
        data: { closedAt },
      }),
      prisma.attendance.updateMany({
        where: { sessionId: req.params.id, exitTime: null },
        data: { exitTime: closedAt },
      }),
    ]);

    getIO()?.to(`session:${req.params.id}`).emit("session:closed", { sessionId: req.params.id, closedAt });
    res.json({ message: "Session closed.", closedAt });
  })
);
sessionRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await prisma.session.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
