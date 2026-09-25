import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { dayEnd, dayStart } from "../services/dates";
import { writeAudit } from "../services/audit";
import { notify } from "../services/notify";

export const leaveApplicationRouter = Router();
leaveApplicationRouter.use(requireAuth);

const include = {
  student: { select: { fullName: true, rollNo: true } },
  reviewer: { select: { fullName: true } },
} as const;

leaveApplicationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
    const rows = await prisma.leaveApplication.findMany({
      where: { ...(isStaff ? {} : { studentId: me.id }), ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: "desc" },
      include,
    });
    res.json({ leaveApplications: rows });
  })
);

const createSchema = z
  .object({
    leaveType: z.enum(["medical", "personal", "event", "other"]),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "From date must be YYYY-MM-DD."),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "To date must be YYYY-MM-DD."),
    reason: z.string().trim().min(5, "Reason must be at least 5 characters.").max(500),
  })
  .refine((d) => d.toDate >= d.fromDate, { message: "To date cannot be before from date.", path: ["toDate"] });

leaveApplicationRouter.post(
  "/",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const d = createSchema.parse(req.body);
    const row = await prisma.leaveApplication.create({
      data: {
        studentId: me.id,
        leaveType: d.leaveType,
        fromDate: new Date(`${d.fromDate}T00:00:00.000Z`),
        toDate: new Date(`${d.toDate}T00:00:00.000Z`),
        reason: d.reason,
      },
      include,
    });
    await writeAudit({ id: me.id, role: me.role }, "submit_leave", "leave_application", {
      entityId: row.id,
      summary: `Submitted ${d.leaveType} leave ${d.fromDate} to ${d.toDate}.`,
      after: { leaveType: d.leaveType, fromDate: d.fromDate, toDate: d.toDate },
    });
    res.status(201).json({ leaveApplication: row });
  })
);

leaveApplicationRouter.post(
  "/:id/withdraw",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const row = await prisma.leaveApplication.findUnique({ where: { id: req.params.id } });
    if (!row) throw notFound("Leave application not found.");
    if (row.studentId !== me.id) throw forbidden();
    if (row.status !== "pending") throw badRequest(`Only pending requests can be withdrawn (this one is ${row.status}).`);
    await prisma.leaveApplication.update({ where: { id: row.id }, data: { status: "withdrawn" } });
    await writeAudit({ id: me.id, role: me.role }, "withdraw_leave", "leave_application", {
      entityId: row.id,
      summary: "Withdrew a pending leave application.",
      before: { status: "pending" },
      after: { status: "withdrawn" },
    });
    res.json({ message: "Leave request withdrawn." });
  })
);

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(400).optional(),
});

/** Approval excuses the student's sessions in the date range (the same flag appeals use). */
leaveApplicationRouter.post(
  "/:id/review",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const { decision, comment } = reviewSchema.parse(req.body);
    const row = await prisma.leaveApplication.findUnique({ where: { id: req.params.id }, include });
    if (!row) throw notFound("Leave application not found.");
    if (row.status !== "pending") throw badRequest(`This request was already ${row.status}.`);

    await prisma.leaveApplication.update({
      where: { id: row.id },
      data: { status: decision, reviewedBy: me.id, reviewedAt: new Date(), reviewComment: comment || null },
    });

    let excused = 0;
    if (decision === "approved") {
      const enrolled = await prisma.enrollment.findMany({
        where: { studentId: row.studentId, active: true },
        select: { courseCode: true },
      });
      const sessions = await prisma.session.findMany({
        where: { openedAt: { gte: dayStart(row.fromDate.toISOString().slice(0, 10)), lte: dayEnd(row.toDate.toISOString().slice(0, 10)) }, course: { in: enrolled.map((e) => e.courseCode) } },
        select: { id: true },
      });
      for (const s of sessions) {
        await prisma.attendance.upsert({
          where: { sessionId_studentId: { sessionId: s.id, studentId: row.studentId } },
          create: { sessionId: s.id, studentId: row.studentId, status: "absent", excused: true },
          update: { excused: true },
        });
        excused += 1;
      }
    }

    const range = `${row.fromDate.toISOString().slice(0, 10)} to ${row.toDate.toISOString().slice(0, 10)}`;
    await notify(
      row.studentId,
      decision === "approved" ? "leave_approved" : "leave_rejected",
      decision === "approved" ? "Leave approved" : "Leave rejected",
      `${row.student.fullName}'s ${row.leaveType} leave (${range}) was ${decision}.${comment ? ` Comment: ${comment}` : ""}`
    );
    await writeAudit({ id: me.id, role: me.role }, `${decision === "approved" ? "approve" : "reject"}_leave`, "leave_application", {
      entityId: row.id,
      summary: `${decision === "approved" ? "Approved" : "Rejected"} ${row.student.fullName}'s leave (${range})${excused ? `, excused ${excused} session(s)` : ""}.`,
      before: { status: "pending" },
      after: { status: decision, comment: comment ?? null, excusedSessions: excused },
    });
    res.json({ message: decision === "approved" ? `Leave approved — ${excused} session(s) excused.` : "Leave rejected." });
  })
);
