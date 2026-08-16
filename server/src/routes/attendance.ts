
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, conflict, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { haversineWithin, effectiveGraceM } from "../services/geofence";
import { euclideanDistance, isFaceMatch, isValidDescriptor } from "../services/face";
import { getIO } from "../sockets/index";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);
attendanceRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;

    if (!isStaff && (studentId === undefined || studentId !== me.id)) {
      throw forbidden();
    }

    const rows = await prisma.attendance.findMany({
      where: {
        ...(sessionId ? { sessionId } : {}),
        ...(studentId ? { studentId } : {}),
      },
      orderBy: { entryTime: "desc" },
      include: { student: { select: { id: true, fullName: true, rollNo: true } } },
    });
    res.json({ attendance: rows });
  })
);
const markEntrySchema = z.object({
  sessionId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000),
  faceConfidence: z.number().min(0).max(1),
  descriptor: z.array(z.number()),
  image: z.string().optional().nullable(),
});

attendanceRouter.post(
  "/",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const input = markEntrySchema.parse(req.body);

    if (!isValidDescriptor(input.descriptor)) {
      throw badRequest("Face capture was invalid â€” please retry.");
    }
    const [session, gps, meProfile] = await Promise.all([
      prisma.session.findUnique({
        where: { id: input.sessionId },
        include: { geofence: true },
      }),
      prisma.gpsSettings.findUnique({ where: { id: true } }),
      prisma.profile.findUnique({ where: { id: me.id } }),
    ]);

    if (!session) throw notFound("Session not found.");
    if (session.closedAt) throw badRequest("This session has already been closed.");

    if (!isValidDescriptor(meProfile?.faceEmbedding ?? null)) {
      throw badRequest(
        "No enrolled face found â€” enrol your face before marking attendance."
      );
    }
    const faceDistance = euclideanDistance(input.descriptor, meProfile!.faceEmbedding as number[]);
    if (!isFaceMatch(faceDistance)) {
      throw badRequest("Face does not match your enrolment â€” please try again.");
    }
    const graceM = effectiveGraceM(input.accuracy, gps?.accuracyGraceM ?? 25);
    const geo = haversineWithin(
      { lat: input.lat, lng: input.lng },
      { lat: Number(session.geofence.lat), lng: Number(session.geofence.lng) },
      session.geofence.radiusM,
      graceM
    );
    if (!geo.within) {
      throw badRequest(
        `You appear to be ${Math.round(geo.distanceM)} m from the classroom (limit ${Math.round(geo.allowedM)} m). Move inside the geofence and retry.`
      );
    }

    const lateAfterMin = gps?.lateAfterMin ?? 10;
    const status: "present" | "late" =
      Date.now() - session.openedAt.getTime() > lateAfterMin * 60_000 ? "late" : "present";
    let row;
    try {
      row = await prisma.attendance.create({
        data: {
          sessionId: input.sessionId,
          studentId: me.id,
          status,
          faceConfidence: input.faceConfidence,
          entryLat: input.lat,
          entryLng: input.lng,
        },
        include: { student: { select: { id: true, fullName: true, rollNo: true } } },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") throw conflict("You have already marked entry for this session.");
      throw err;
    }
    getIO()?.to(`session:${input.sessionId}`).emit("attendance:new", { attendance: row });
    res.status(201).json({ attendance: row, status, lateAfterMin });
  })
);
attendanceRouter.post(
  "/:id/exit",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const record = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: { session: { select: { closedAt: true } } },
    });
    if (!record || record.studentId !== me.id) throw notFound("Attendance record not found.");
    if (record.exitTime) throw badRequest("Exit already recorded.");

    const now = new Date();
    const leftEarly = !record.session.closedAt;
    const status = leftEarly && record.status === "present" ? "partial" : record.status;

    const updated = await prisma.attendance.update({
      where: { id: req.params.id },
      data: { exitTime: now, status },
    });

    getIO()?.to(`session:${record.sessionId}`).emit("attendance:updated", { attendance: updated });
    res.json({ attendance: updated });
  })
);
attendanceRouter.delete(
  "/:id",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    await prisma.attendance.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
