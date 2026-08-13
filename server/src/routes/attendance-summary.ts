
import { Router } from "express";
import { asyncHandler, forbidden } from "../middleware/error-handler";
import { requireAuth } from "../middleware/auth";
import { fetchAttendanceSummary } from "../services/attendance-summary";

export const attendanceSummaryRouter = Router();

attendanceSummaryRouter.use(requireAuth);

attendanceSummaryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";

    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : me.id;
    if (!isStaff && studentId !== me.id) throw forbidden();

    const rows = await fetchAttendanceSummary({
      studentId: isStaff ? studentId : me.id,
      courseCode: typeof req.query.courseCode === "string" ? req.query.courseCode : undefined,
    });
    res.json({ rows });
  })
);
