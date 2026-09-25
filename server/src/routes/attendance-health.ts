import { Router } from "express";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeAttendanceHealth, HEALTH_THRESHOLDS } from "../services/attendance-health";
import { courseScope } from "../services/scope";

export const attendanceHealthRouter = Router();
attendanceHealthRouter.use(requireAuth);

attendanceHealthRouter.get(
  "/",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const good = Number(req.query.good);
    const warning = Number(req.query.warning);
    const t =
      Number.isFinite(good) && Number.isFinite(warning) && good > warning && warning > 0 && good <= 100
        ? { good, warning }
        : HEALTH_THRESHOLDS;
    res.json(await computeAttendanceHealth(t, (await courseScope(req.user!)) ?? undefined));
  })
);
