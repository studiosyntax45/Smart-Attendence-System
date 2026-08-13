
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, conflict, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";

export const leaveRouter = Router();

leaveRouter.use(requireAuth);

leaveRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";

    const where: Record<string, unknown> = {};
    if (!isStaff) {
      where.studentId = me.id;
    } else if (req.query.mine === "true") {
      where.studentId = me.id;
    }

    const rows = await prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { fullName: true, rollNo: true } },
        session: { select: { course: true, openedAt: true, facultyId: true } },
      },
    });
    let scoped = rows;
    if (isStaff && req.query.mine !== "true" && me.role === "faculty") {
      scoped = rows.filter((r) => r.session.facultyId === me.id);
    }
    res.json({ leaveRequests: scoped });
  })
);

const fileSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

leaveRouter.post(
  "/",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const data = fileSchema.parse(req.body);

    const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
    if (!session) throw notFound("That session no longer exists.");

    const attendance = await prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: data.sessionId, studentId: me.id } },
    });
    if (attendance?.excused) throw badRequest("This session is already excused.");

    try {
      const created = await prisma.leaveRequest.create({
        data: {
          studentId: me.id,
          sessionId: data.sessionId,
          reason: data.reason.trim(),
          status: "pending",
        },
      });
      res.status(201).json({ leaveRequest: created });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") throw conflict("You already filed an appeal for this session.");
      throw err;
    }
  })
);

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

leaveRouter.post(
  "/:id/review",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const { decision } = reviewSchema.parse(req.body);

    const existing = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      include: { session: { select: { facultyId: true } } },
    });
    if (!existing) throw notFound("That appeal no longer exists.");
    if (existing.status !== "pending") throw badRequest(`This appeal was already ${existing.status}.`);
    if (me.role === "faculty" && existing.session.facultyId !== me.id) {
      throw forbidden("You can only review appeals for sessions you opened.");
    }

    const reviewedAt = new Date();

    await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: decision, reviewedBy: me.id, reviewedAt },
    });

    if (decision === "approved") {
      const existing2 = await prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: existing.sessionId, studentId: existing.studentId } },
      });
      if (existing2) {
        await prisma.attendance.update({ where: { id: existing2.id }, data: { excused: true } });
      } else {
        await prisma.attendance.create({
          data: { sessionId: existing.sessionId, studentId: existing.studentId, status: "absent", excused: true },
        });
      }
    }
    res.json({ message: decision === "approved" ? "Appeal approved." : "Appeal rejected." });
  })
);
