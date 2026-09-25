import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { notify, runAttendanceNotificationCheck } from "../services/notify";

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";
    const userId = typeof req.query.userId === "string" ? req.query.userId : me.id;
    if (!isStaff && userId !== me.id) throw forbidden();

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
  })
);

notificationRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const row = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!row) throw notFound("Notification not found.");
    if (row.userId !== me.id && me.role !== "admin") throw forbidden();
    await prisma.notification.update({ where: { id: row.id }, data: { read: true } });
    res.json({ ok: true });
  })
);

notificationRouter.post(
  "/run-attendance-check",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const created = await runAttendanceNotificationCheck({ id: req.user!.id, role: req.user!.role });
    res.json({
      created,
      message:
        created === 0
          ? "No new alerts — every student below the threshold already has an unread alert."
          : `Sent ${created} new low-attendance alert${created === 1 ? "" : "s"}.`,
    });
  })
);

const sendSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(400),
});
notificationRouter.post(
  "/",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const data = sendSchema.parse(req.body);
    await notify(data.userId, "general", data.title, data.body);
    res.status(201).json({ ok: true });
  })
);
