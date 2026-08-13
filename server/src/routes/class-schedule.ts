
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";

export const scheduleRouter = Router();

scheduleRouter.use(requireAuth);

scheduleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const dayOfWeek =
      typeof req.query.dayOfWeek === "string" ? Number(req.query.dayOfWeek) : undefined;
    const facultyId = typeof req.query.facultyId === "string" ? req.query.facultyId : undefined;

    const where: Record<string, unknown> = {};
    if (dayOfWeek !== undefined && !Number.isNaN(dayOfWeek)) where.dayOfWeek = dayOfWeek;
    if (facultyId) where.facultyId = facultyId;
    if (me.role === "faculty") where.facultyId = me.id;

    const rows = await prisma.classSchedule.findMany({
      where,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: {
        geofence: { select: { roomName: true } },
        class_: true,
        faculty: { select: { id: true, fullName: true } },
      },
    });
    res.json({ schedule: rows });
  })
);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  course: z.string().min(1),
  facultyId: z.string().uuid(),
  geofenceId: z.string().uuid(),
  classId: z.string().uuid().nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

function normaliseTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

scheduleRouter.post(
  "/",
  requireRole("admin", "faculty"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const data = upsertSchema.parse(req.body);
    const start = normaliseTime(data.startTime);
    const end = normaliseTime(data.endTime);
    if (start >= end) throw badRequest("Start time must be before end time.");
    if (me.role === "faculty" && data.facultyId !== me.id) throw forbidden();

    const facultyProfile = await prisma.profile.findUnique({
      where: { id: data.facultyId },
      select: { role: true },
    });
    if (!facultyProfile || (facultyProfile.role !== "faculty" && facultyProfile.role !== "admin")) {
      throw badRequest("Choose a faculty member.");
    }

    const payload = {
      course: data.course,
      facultyId: data.facultyId,
      geofenceId: data.geofenceId,
      classId: data.classId ?? null,
      dayOfWeek: data.dayOfWeek,
      startTime: start,
      endTime: end,
    };

    let row;
    if (data.id) {
      if (me.role === "faculty") {
        const existing = await prisma.classSchedule.findUnique({ where: { id: data.id } });
        if (!existing || existing.facultyId !== me.id) throw forbidden();
      }
      row = await prisma.classSchedule.update({ where: { id: data.id }, data: payload });
    } else {
      row = await prisma.classSchedule.create({ data: payload });
    }
    res.json({ entry: row });
  })
);

scheduleRouter.delete(
  "/:id",
  requireRole("admin", "faculty"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const existing = await prisma.classSchedule.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Schedule entry not found.");
    if (me.role === "faculty" && existing.facultyId !== me.id) throw forbidden();
    await prisma.classSchedule.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
