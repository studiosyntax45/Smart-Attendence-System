import { Router } from "express";
import { asyncHandler, forbidden } from "../middleware/error-handler";
import { requireAuth } from "../middleware/auth";
import { fetchAttendanceSummary } from "../services/attendance-summary";
import { courseScope } from "../services/scope";

export const attendanceSummaryRouter = Router();

attendanceSummaryRouter.use(requireAuth);

attendanceSummaryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";

    const queryStudentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
    if (!isStaff && queryStudentId && queryStudentId !== me.id) throw forbidden();

    // Staff see everyone unless a studentId is given; students only themselves.
    const rows = await fetchAttendanceSummary({
      studentId: isStaff ? queryStudentId : me.id,
      courseCode: typeof req.query.courseCode === "string" ? req.query.courseCode : undefined,
      courseCodes: isStaff ? (await courseScope(me)) ?? undefined : undefined,
    });
    res.json({ rows });
  })
);
