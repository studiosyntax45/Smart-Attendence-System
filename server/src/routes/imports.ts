import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { dayEnd, dayStart } from "../services/dates";
import { hashPassword } from "../services/auth";
import { writeAudit, type AuditActor } from "../services/audit";
import { emptySummary, normaliseUsn, type ImportSummary, type RowError } from "../services/bulk";

export const importRouter = Router();
importRouter.use(requireAuth);

const DEFAULT_PASSWORD = "Pes@12345";
const actorOf = (req: { user?: { id: string; role: string } }): AuditActor => ({
  id: req.user!.id,
  role: req.user!.role,
});

const studentRow = z.object({
  usn: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  branch: z.string().trim().optional().default(""),
  year: z.coerce.number().int().min(1).max(6).optional(),
  section: z.string().trim().optional().default(""),
  parentEmail: z.string().trim().email().optional().or(z.literal("")),
});
const studentsBody = z.object({ rows: z.array(z.record(z.any())).min(1).max(500) });

importRouter.post(
  "/students",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { rows } = studentsBody.parse(req.body);
    const summary = emptySummary();
    const errors: RowError[] = [];

    const existingProfiles = await prisma.profile.findMany({
      where: { rollNo: { not: null } },
      select: { id: true, rollNo: true },
    });
    const byUsn = new Map(existingProfiles.filter((p) => p.rollNo).map((p) => [normaliseUsn(p.rollNo!), p.id]));
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const line = Number(rows[i]._line) || i + 2;
      const parsed = studentRow.safeParse(rows[i]);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        errors.push({ row: line, key: String(rows[i].usn ?? ""), field: first.path.join(".") || "row", error: first.message });
        continue;
      }
      const d = parsed.data;
      const key = normaliseUsn(d.usn);
      if (seen.has(key)) {
        errors.push({ row: line, key: d.usn, field: "usn", error: "Duplicate USN in the file." });
        continue;
      }
      seen.add(key);

      try {
        const existingId = byUsn.get(key);
        const emailOwner = await prisma.authUser.findUnique({ where: { email: d.email }, select: { id: true } });
        if (emailOwner && emailOwner.id !== existingId) {
          errors.push({ row: line, key: d.usn, field: "email", error: `Email ${d.email} is already used by another account.` });
          continue;
        }

        if (existingId) {
          await prisma.$transaction([
            prisma.authUser.update({ where: { id: existingId }, data: { email: d.email } }),
            prisma.profile.update({ where: { id: existingId }, data: { fullName: d.name, rollNo: d.usn } }),
            prisma.studentDetails.upsert({
              where: { studentId: existingId },
              create: {
                studentId: existingId,
                branch: d.branch || null,
                section: d.section || null,
                year: d.year ?? null,
                parentEmail: d.parentEmail || null,
              },
              update: { branch: d.branch || null, section: d.section || null, year: d.year ?? null, parentEmail: d.parentEmail || null },
            }),
          ]);
          summary.updated += 1;
        } else {
          const id = crypto.randomUUID();
          const passwordHash = await hashPassword(DEFAULT_PASSWORD);
          await prisma.$transaction([
            prisma.authUser.create({ data: { id, email: d.email, passwordHash } }),
            prisma.profile.create({ data: { id, fullName: d.name, rollNo: d.usn, role: "student" } }),
            prisma.studentDetails.create({
              data: {
                studentId: id,
                branch: d.branch || null,
                section: d.section || null,
                year: d.year ?? null,
                parentEmail: d.parentEmail || null,
              },
            }),
          ]);
          summary.created += 1;
        }
      } catch (err) {
        errors.push({ row: line, key: d.usn, field: "row", error: err instanceof Error ? err.message : "Write failed." });
      }
    }

    summary.errors = errors;
    summary.skipped = errors.length;
    await audit(actorOf(req), "import_students", "student", summary);
    res.json({ summary, defaultPassword: DEFAULT_PASSWORD });
  })
);

const courseRow = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,20}$/, "Code must be 2-20 letters/digits/hyphens."),
  name: z.string().trim().min(1),
  credits: z.coerce.number().min(0).max(10),
  semester: z.string().trim().min(1),
});
importRouter.post(
  "/courses",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { rows } = studentsBody.parse(req.body);
    const summary = emptySummary();
    const errors: RowError[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const line = Number(rows[i]._line) || i + 2;
      const parsed = courseRow.safeParse(rows[i]);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        errors.push({ row: line, key: String(rows[i].code ?? ""), field: first.path.join(".") || "row", error: first.message });
        continue;
      }
      const d = parsed.data;
      const code = d.code.toUpperCase();
      if (seen.has(code)) {
        errors.push({ row: line, key: code, field: "code", error: "Duplicate course code in the file." });
        continue;
      }
      seen.add(code);
      try {
        const existing = await prisma.course.findUnique({ where: { code } });
        await prisma.course.upsert({
          where: { code },
          create: { code, name: d.name, credits: d.credits, semester: d.semester },
          update: { name: d.name, credits: d.credits, semester: d.semester },
        });
        if (existing) summary.updated += 1;
        else summary.created += 1;
      } catch (err) {
        errors.push({ row: line, key: code, field: "row", error: err instanceof Error ? err.message : "Write failed." });
      }
    }
    summary.errors = errors;
    summary.skipped = errors.length;
    await audit(actorOf(req), "import_courses", "course", summary);
    res.json({ summary });
  })
);

const enrollRow = z.object({
  usn: z.string().trim().min(1),
  courseCode: z.string().trim().min(1),
});
importRouter.post(
  "/enrollments",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const { rows } = studentsBody.parse(req.body);
    const summary = emptySummary();
    const errors: RowError[] = [];

    const [students, courses] = await Promise.all([
      prisma.profile.findMany({ where: { role: "student", rollNo: { not: null } }, select: { id: true, rollNo: true } }),
      prisma.course.findMany({ select: { code: true } }),
    ]);
    const byUsn = new Map(students.filter((s) => s.rollNo).map((s) => [normaliseUsn(s.rollNo!), s.id]));
    const codes = new Set(courses.map((c) => c.code));
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const line = Number(rows[i]._line) || i + 2;
      const parsed = enrollRow.safeParse(rows[i]);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        errors.push({ row: line, key: String(rows[i].usn ?? ""), field: first.path.join(".") || "row", error: first.message });
        continue;
      }
      const d = parsed.data;
      const code = d.courseCode.toUpperCase();
      const studentId = byUsn.get(normaliseUsn(d.usn));
      const dedup = `${normaliseUsn(d.usn)}|${code}`;
      if (!studentId) {
        errors.push({ row: line, key: d.usn, field: "usn", error: "USN not found among students." });
        continue;
      }
      if (!codes.has(code)) {
        errors.push({ row: line, key: d.usn, field: "courseCode", error: `Course ${code} does not exist.` });
        continue;
      }
      if (seen.has(dedup)) {
        errors.push({ row: line, key: d.usn, field: "row", error: "Duplicate USN+course in the file." });
        continue;
      }
      seen.add(dedup);
      try {
        const existing = await prisma.enrollment.findUnique({
          where: { studentId_courseCode: { studentId, courseCode: code } },
        });
        if (existing) {
          if (!existing.active) {
            await prisma.enrollment.update({ where: { id: existing.id }, data: { active: true } });
            summary.updated += 1;
          } else {
            summary.skipped += 1; // already enrolled, not an error
          }
        } else {
          await prisma.enrollment.create({ data: { studentId, courseCode: code } });
          summary.created += 1;
        }
      } catch (err) {
        errors.push({ row: line, key: d.usn, field: "row", error: err instanceof Error ? err.message : "Write failed." });
      }
    }
    summary.errors = errors;
    summary.skipped += errors.length;
    await audit(actorOf(req), "import_enrollments", "enrollment", summary);
    res.json({ summary });
  })
);

// Staff correction: writes to that course's session on that date. Students still self-mark.
const attRow = z.object({
  usn: z.string().trim().min(1),
  courseCode: z.string().trim().min(1),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
  status: z.string().trim().transform((s) => s.toLowerCase()),
});
const VALID_STATUS = new Set(["present", "late", "absent", "partial"]);
importRouter.post(
  "/attendance",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const { rows } = studentsBody.parse(req.body);
    const summary = emptySummary();
    const errors: RowError[] = [];

    const students = await prisma.profile.findMany({
      where: { role: "student", rollNo: { not: null } },
      select: { id: true, rollNo: true },
    });
    const byUsn = new Map(students.filter((s) => s.rollNo).map((s) => [normaliseUsn(s.rollNo!), s.id]));

    for (let i = 0; i < rows.length; i++) {
      const line = Number(rows[i]._line) || i + 2;
      const parsed = attRow.safeParse(rows[i]);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        errors.push({ row: line, key: String(rows[i].usn ?? ""), field: first.path.join(".") || "row", error: first.message });
        continue;
      }
      const d = parsed.data;
      const studentId = byUsn.get(normaliseUsn(d.usn));
      if (!studentId) {
        errors.push({ row: line, key: d.usn, field: "usn", error: "USN not found." });
        continue;
      }
      if (!VALID_STATUS.has(d.status)) {
        errors.push({ row: line, key: d.usn, field: "status", error: `Status must be one of ${[...VALID_STATUS].join(", ")}.` });
        continue;
      }
      const from = dayStart(d.date);
      const until = dayEnd(d.date);
      const session = await prisma.session.findFirst({
        where: { course: d.courseCode.toUpperCase(), openedAt: { gte: from, lte: until } },
        orderBy: { openedAt: "desc" },
      });
      if (!session) {
        errors.push({ row: line, key: d.usn, field: "date", error: `No ${d.courseCode.toUpperCase()} session on ${d.date}.` });
        continue;
      }
      try {
        const existing = await prisma.attendance.findUnique({
          where: { sessionId_studentId: { sessionId: session.id, studentId } },
        });
        if (existing) {
          await prisma.attendance.update({ where: { id: existing.id }, data: { status: d.status as never } });
          summary.updated += 1;
        } else {
          await prisma.attendance.create({
            data: { sessionId: session.id, studentId, status: d.status as never },
          });
          summary.created += 1;
        }
      } catch (err) {
        errors.push({ row: line, key: d.usn, field: "row", error: err instanceof Error ? err.message : "Write failed." });
      }
    }
    summary.errors = errors;
    summary.skipped = errors.length;
    await audit(actorOf(req), "import_attendance", "attendance", summary);
    res.json({ summary });
  })
);

const facultyRow = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().toLowerCase().email("Not a valid email."),
});
importRouter.post(
  "/faculty",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { rows } = studentsBody.parse(req.body);
    const summary = emptySummary();
    const errors: RowError[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const line = Number(rows[i]._line) || i + 2;
      const parsed = facultyRow.safeParse(rows[i]);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        errors.push({ row: line, key: String(rows[i].email ?? ""), field: first.path.join(".") || "row", error: first.message });
        continue;
      }
      const d = parsed.data;
      if (seen.has(d.email)) {
        errors.push({ row: line, key: d.email, field: "email", error: "Duplicate email in the file." });
        continue;
      }
      seen.add(d.email);
      try {
        const existing = await prisma.authUser.findUnique({ where: { email: d.email }, include: { profile: true } });
        if (existing) {
          if (existing.profile?.role !== "faculty") {
            errors.push({ row: line, key: d.email, field: "email", error: `${d.email} already belongs to a ${existing.profile?.role ?? "user"} account.` });
            continue;
          }
          await prisma.profile.update({ where: { id: existing.id }, data: { fullName: d.name } });
          summary.updated += 1;
        } else {
          const id = crypto.randomUUID();
          const passwordHash = await hashPassword(DEFAULT_PASSWORD);
          await prisma.$transaction([
            prisma.authUser.create({ data: { id, email: d.email, passwordHash } }),
            prisma.profile.create({ data: { id, fullName: d.name, role: "faculty" } }),
          ]);
          summary.created += 1;
        }
      } catch (err) {
        errors.push({ row: line, key: d.email, field: "row", error: err instanceof Error ? err.message : "Write failed." });
      }
    }
    summary.errors = errors;
    summary.skipped = errors.length;
    await audit(actorOf(req), "import_faculty", "user", summary);
    res.json({ summary, defaultPassword: DEFAULT_PASSWORD });
  })
);

const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const pad = (t: string) => (t.length === 4 ? `0${t}` : t);
const timetableRow = z.object({
  day: z.string().trim().transform((v) => v.slice(0, 3).toLowerCase()).refine((v) => v in DAY_INDEX, "Day must be a weekday name like Mon."),
  start: z.string().trim().regex(HHMM, "Start must be HH:MM.").transform(pad),
  end: z.string().trim().regex(HHMM, "End must be HH:MM.").transform(pad),
  courseCode: z.string().trim().min(1).transform((v) => v.toUpperCase()),
  facultyEmail: z.string().trim().toLowerCase().email("Not a valid email."),
  room: z.string().trim().min(1),
  class: z.string().trim().optional(),
});
importRouter.post(
  "/timetable",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { rows } = studentsBody.parse(req.body);
    const summary = emptySummary();
    const errors: RowError[] = [];

    const [faculty, rooms, classes, courses] = await Promise.all([
      prisma.authUser.findMany({
        where: { profile: { role: { in: ["faculty", "admin"] } } },
        select: { id: true, email: true },
      }),
      prisma.geofence.findMany({ select: { id: true, roomName: true } }),
      prisma.class.findMany({ select: { id: true, name: true } }),
      prisma.course.findMany({ select: { code: true } }),
    ]);
    const facultyByEmail = new Map(faculty.map((f) => [f.email.toLowerCase(), f.id]));
    const roomByName = new Map(rooms.map((r) => [r.roomName.toLowerCase(), r.id]));
    const classByName = new Map(classes.map((c) => [c.name.toLowerCase(), c.id]));
    const codes = new Set(courses.map((c) => c.code));
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const line = Number(rows[i]._line) || i + 2;
      const key = String(rows[i].facultyEmail ?? "");
      const parsed = timetableRow.safeParse(rows[i]);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        errors.push({ row: line, key, field: first.path.join(".") || "row", error: first.message });
        continue;
      }
      const d = parsed.data;
      const fail = (field: string, error: string) => errors.push({ row: line, key: d.facultyEmail, field, error });
      const facultyId = facultyByEmail.get(d.facultyEmail);
      const geofenceId = roomByName.get(d.room.toLowerCase());
      const classId = d.class ? classByName.get(d.class.toLowerCase()) : null;
      if (d.end <= d.start) { fail("end", "End time must be after start time."); continue; }
      if (!codes.has(d.courseCode)) { fail("courseCode", `Course ${d.courseCode} does not exist.`); continue; }
      if (!facultyId) { fail("facultyEmail", `No faculty account with email ${d.facultyEmail}.`); continue; }
      if (!geofenceId) { fail("room", `Room "${d.room}" is not a configured geofence.`); continue; }
      if (d.class && !classId) { fail("class", `Class "${d.class}" does not exist.`); continue; }
      const dayOfWeek = DAY_INDEX[d.day];
      const startTime = `${d.start}:00`;
      const slotKey = `${facultyId}|${dayOfWeek}|${startTime}`;
      if (seen.has(slotKey)) { fail("facultyEmail", "This faculty member is already teaching at this day and start time in this file."); continue; }
      seen.add(slotKey);

      try {
        const data = { course: d.courseCode, facultyId, geofenceId, classId: classId ?? null, dayOfWeek, startTime, endTime: `${d.end}:00` };
        // Same teacher + day + start time is the same slot, so re-uploads update it.
        const existing = await prisma.classSchedule.findFirst({ where: { facultyId, dayOfWeek, startTime } });
        if (existing) {
          await prisma.classSchedule.update({ where: { id: existing.id }, data });
          summary.updated += 1;
        } else {
          await prisma.classSchedule.create({ data });
          summary.created += 1;
        }
      } catch (err) {
        fail("row", err instanceof Error ? err.message : "Write failed.");
      }
    }
    summary.errors = errors;
    summary.skipped = errors.length;
    await audit(actorOf(req), "import_timetable", "timetable", summary);
    res.json({ summary });
  })
);

async function audit(actor: AuditActor, action: string, entity: string, summary: ImportSummary): Promise<void> {
  await writeAudit(actor, action, entity, {
    summary: `Import: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.errors.length} errored.`,
    after: { created: summary.created, updated: summary.updated, skipped: summary.skipped, errors: summary.errors.length },
  });
}
