import { prisma } from "../config/db";
import { computeAttendanceHealth } from "./attendance-health";
import type { AuditActor } from "./audit";
import { writeAudit } from "./audit";

type NotificationType =
  | "attendance_alert"
  | "low_attendance"
  | "leave_approved"
  | "leave_rejected"
  | "appeal_approved"
  | "appeal_rejected"
  | "general";

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type: type as never, title, body: body.slice(0, 400) },
    });
  } catch (err) {
    console.error("[notify] failed", type, err);
  }
}

/** Alerts each warning/critical student without an unread alert; returns how many were created. */
export async function runAttendanceNotificationCheck(actor: AuditActor | null): Promise<number> {
  const health = await computeAttendanceHealth();
  const flagged = health.students.filter((s) => s.status === "warning" || s.status === "critical");

  let created = 0;
  for (const s of flagged) {
    const existing = await prisma.notification.findFirst({
      where: { userId: s.studentId, type: "low_attendance" as never, read: false },
    });
    if (existing) continue;
    const critical = s.status === "critical";
    await notify(
      s.studentId,
      "low_attendance",
      critical ? "Attendance critical" : "Low attendance warning",
      critical
        ? `${s.fullName}'s overall attendance is ${s.pct}%, below the ${health.thresholds.warning}% critical mark. Please meet the class mentor.`
        : `${s.fullName}'s overall attendance is ${s.pct}%, below the ${health.thresholds.good}% eligibility requirement.`
    );
    created += 1;
  }

  // Seed re-runs that create nothing aren't logged.
  if (actor || created > 0) await writeAudit(actor, "run_attendance_check", "notification", {
    summary: `Attendance check flagged ${flagged.length} student(s), created ${created} new notification(s).`,
    after: { flagged: flagged.length, created },
  });
  return created;
}
