/** Demo cohort (24 students, 4 courses). Seeded PRNG + fixed ids, so re-runs update instead of duplicating. */
import { prisma } from "../config/db";
import { hashPassword } from "../services/auth";
import { runAttendanceNotificationCheck } from "../services/notify";

const PASSWORD = "Pes@12345";
const DAY = 86_400_000;
const SESSIONS_PER_COURSE = 20;

// Overall attendance targets, chosen so all three health bands are populated:
// 13 students at 75%+, 6 between 65 and 74%, 5 below 65%.
const STUDENTS: Array<[name: string, target: number]> = [
  ["Aarav Sharma", 96], ["Ananya Rao", 93], ["Rahul Kumar", 91], ["Priya Sharma", 90],
  ["Karthik Reddy", 88], ["Sneha Iyer", 86], ["Vikram Singh", 85], ["Divya Nair", 83],
  ["Rohan Mehta", 81], ["Meghana Gowda", 79], ["Aditya Kulkarni", 78], ["Pooja Hegde", 77],
  ["Nikhil Joshi", 76], ["Kavya Menon", 74], ["Siddharth Patil", 73], ["Ishita Verma", 72],
  ["Varun Shetty", 70], ["Lakshmi Prasad", 68], ["Harsha Bhat", 66], ["Nandini Murthy", 64],
  ["Arjun Desai", 62], ["Shreya Pillai", 60], ["Manish Yadav", 58], ["Tanvi Kamath", 52],
];

const FACULTY = [
  { email: "kavitha.rao@pesu.pes.edu", fullName: "Dr. Kavitha Rao" },
  { email: "suresh.nair@pesu.pes.edu", fullName: "Prof. Suresh Nair" },
];

// facultyKey: index into FACULTY, or "demo" for faculty@pesu.pes.edu so the demo login owns a course.
const COURSES: Array<{ code: string; name: string; credits: number; facultyKey: number | "demo" }> = [
  { code: "CS301", name: "Data Structures", credits: 4, facultyKey: 0 },
  { code: "CS302", name: "Database Systems", credits: 4, facultyKey: 1 },
  { code: "CS303", name: "Computer Networks", credits: 3, facultyKey: 0 },
  { code: "CS304", name: "Operating Systems", credits: 4, facultyKey: "demo" },
];

/** mulberry32 seeded PRNG: same demo data every run. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fixedId = (prefix: string, n: number) =>
  `${prefix.padEnd(8, "0").slice(0, 8)}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const usnFor = (i: number) => `PES1UG23CS${String(i + 1).padStart(3, "0")}`;
const emailFor = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@pesu.pes.edu`;
const dayAgo = (base: number, days: number) => new Date(base - days * DAY);

export function istMorning(): number {
  const d = new Date();
  d.setUTCHours(3, 30, 0, 0);
  return d.getTime();
}

/** Whole days back from base (09:00 IST), moved to Saturday if it lands on a Sunday. */
export function classDay(base: number, daysBack: number): Date {
  const d = dayAgo(base, daysBack);
  return d.getUTCDay() === 0 ? new Date(d.getTime() - DAY) : d;
}

/** Moves an existing session and its attendance to openedAt, repairing data from older seeds. */
export async function alignSession(id: string, openedAt: Date, lengthMin: number): Promise<void> {
  const s = await prisma.session.findUnique({ where: { id }, select: { openedAt: true } });
  if (!s) return;
  const deltaSec = Math.round((openedAt.getTime() - s.openedAt.getTime()) / 1000);
  if (deltaSec === 0) return;
  await prisma.session.update({ where: { id }, data: { openedAt, closedAt: new Date(openedAt.getTime() + lengthMin * 60_000) } });
  await prisma.$executeRaw`UPDATE attendance SET entry_time = DATE_ADD(entry_time, INTERVAL ${deltaSec} SECOND), exit_time = IF(exit_time IS NULL, NULL, DATE_ADD(exit_time, INTERVAL ${deltaSec} SECOND)) WHERE session_id = ${id} AND NOT (status = 'absent' AND excused = 1)`;
}

async function upsertUser(email: string, fullName: string, role: "student" | "faculty", rollNo: string | null, hash: string) {
  const existing = await prisma.authUser.findUnique({ where: { email } });
  const id = existing?.id ?? crypto.randomUUID();
  if (!existing) await prisma.authUser.create({ data: { id, email, passwordHash: hash } });
  await prisma.profile.upsert({
    where: { id },
    update: { fullName, role, rollNo },
    create: { id, fullName, role, rollNo },
  });
  return id;
}

export async function seedCohort(fenceId: string): Promise<void> {
  const hash = await hashPassword(PASSWORD);
  const base = istMorning();
  // Session n of course ci: every ~2.5 days (whole days, no Sundays), at 09:00 + ci hours IST.
  const sessionTime = (n: number, ci: number) =>
    new Date(classDay(base, 2 + Math.round((SESSIONS_PER_COURSE - 1 - n) * 2.5)).getTime() + ci * 60 * 60_000);

  const demoFaculty = await prisma.authUser.findUnique({ where: { email: "faculty@pesu.pes.edu" } });
  const admin = await prisma.authUser.findUnique({ where: { email: "admin@pesu.pes.edu" } });
  const facultyIds: string[] = [];
  for (const f of FACULTY) facultyIds.push(await upsertUser(f.email, f.fullName, "faculty", null, hash));
  const facultyFor = (key: number | "demo") => (key === "demo" ? demoFaculty?.id ?? facultyIds[0] : facultyIds[key]);

  const studentIds: string[] = [];
  for (const [i, [name]] of STUDENTS.entries()) {
    const id = await upsertUser(emailFor(name), name, "student", usnFor(i), hash);
    studentIds.push(id);
    const section = i < 12 ? "A" : "B";
    await prisma.studentDetails.upsert({
      where: { studentId: id },
      update: { branch: "CSE", section, year: 3, parentEmail: `parent.${emailFor(name).split("@")[0]}@gmail.com` },
      create: {
        studentId: id,
        pesuId: usnFor(i),
        branch: "CSE",
        section,
        year: 3,
        parentEmail: `parent.${emailFor(name).split("@")[0]}@gmail.com`,
        city: "Bengaluru",
        state: "Karnataka",
      },
    });
  }
  console.log(`  cohort: ${studentIds.length} students, ${FACULTY.length} extra faculty (password ${PASSWORD})`);

  for (const c of COURSES) {
    await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits, semester: "Sem-5" },
      create: { code: c.code, name: c.name, credits: c.credits, semester: "Sem-5" },
    });
  }
  for (const section of ["A", "B"]) {
    const cls = await prisma.class.upsert({
      where: { branch_semester_section_academicYear: { branch: "CSE", semester: "Sem-5", section, academicYear: "2026-2027" } },
      update: {},
      create: { name: `CSE Sem-5 ${section}`, branch: "CSE", semester: "Sem-5", section, academicYear: "2026-2027" },
    });
    for (const c of COURSES) {
      await prisma.classCourse.upsert({
        where: { classId_courseCode: { classId: cls.id, courseCode: c.code } },
        update: {},
        create: { classId: cls.id, courseCode: c.code },
      });
    }
    for (const [i, sid] of studentIds.entries()) {
      if ((i < 12 ? "A" : "B") !== section) continue;
      await prisma.classStudent.upsert({
        where: { classId_studentId: { classId: cls.id, studentId: sid } },
        update: {},
        create: { classId: cls.id, studentId: sid },
      });
    }
  }
  for (const sid of studentIds) {
    for (const c of COURSES) {
      await prisma.enrollment.upsert({
        where: { studentId_courseCode: { studentId: sid, courseCode: c.code } },
        update: { active: true },
        create: { studentId: sid, courseCode: c.code, enrolledAt: dayAgo(base, 120) },
      });
    }
  }

  const sessionIds: Record<string, string[]> = {};
  for (const [ci, c] of COURSES.entries()) {
    sessionIds[c.code] = [];
    for (let n = 0; n < SESSIONS_PER_COURSE; n++) {
      const id = fixedId(`5e5510${ci}`, n + 1);
      const openedAt = sessionTime(n, ci);
      await alignSession(id, openedAt, 55);
      await prisma.session.upsert({
        where: { id },
        update: { course: c.code, facultyId: facultyFor(c.facultyKey) },
        create: {
          id,
          course: c.code,
          facultyId: facultyFor(c.facultyKey),
          geofenceId: fenceId,
          openedAt,
          closedAt: new Date(openedAt.getTime() + 55 * 60_000),
        },
      });
      sessionIds[c.code].push(id);
    }
  }

  const alreadySeeded = await prisma.attendance.count({ where: { studentId: studentIds[0], sessionId: { in: sessionIds.CS301 } } });
  if (alreadySeeded === 0) {
    for (const [si, sid] of studentIds.entries()) {
      const target = STUDENTS[si][1];
      for (const [ci, c] of COURSES.entries()) {
        const rand = prng(si * 97 + ci * 13 + 7);
        const coursePct = Math.max(30, Math.min(100, target + Math.round((rand() - 0.5) * 8)));
        const attendCount = Math.round((coursePct / 100) * SESSIONS_PER_COURSE);
        const order = [...Array(SESSIONS_PER_COURSE).keys()].sort(() => rand() - 0.5);
        const attended = new Set(order.slice(0, attendCount));
        const data = [];
        for (let n = 0; n < SESSIONS_PER_COURSE; n++) {
          if (!attended.has(n)) continue;
          const r = rand();
          const status = r < 0.1 ? "late" : r < 0.14 ? "partial" : "present";
          const sessionId = sessionIds[c.code][n];
          const opened = sessionTime(n, ci);
          data.push({
            sessionId,
            studentId: sid,
            status: status as "present" | "late" | "partial",
            entryTime: new Date(opened.getTime() + (status === "late" ? 14 : 3) * 60_000),
            exitTime: new Date(opened.getTime() + (status === "partial" ? 30 : 55) * 60_000),
            faceConfidence: 0.9,
            entryLat: 12.9351,
            entryLng: 77.5358,
          });
        }
        await prisma.attendance.createMany({ data, skipDuplicates: true });
      }
    }
    console.log(`  attendance: ${COURSES.length} courses x ${SESSIONS_PER_COURSE} sessions x ${studentIds.length} students`);
  } else {
    console.log("  attendance already seeded — left unchanged");
  }

  const ASSESS: Array<[string, number]> = [["ISA-1", 40], ["ISA-2", 40], ["Assignment", 20], ["ESA", 100]];
  for (const [si, sid] of studentIds.entries()) {
    for (const [ci, c] of COURSES.entries()) {
      const rand = prng(si * 1009 + ci * 31 + 3);
      for (const [name, max] of ASSESS) {
        const pct = Math.max(18, Math.min(98, 30 + STUDENTS[si][1] * 0.6 + (rand() - 0.5) * 18));
        const score = Math.round((pct / 100) * max * 2) / 2;
        await prisma.marks.upsert({
          where: { studentId_course_assessment: { studentId: sid, course: c.code, assessment: name } },
          update: { score, maxScore: max },
          create: { studentId: sid, course: c.code, assessment: name, score, maxScore: max, updatedBy: facultyFor(c.facultyKey) },
        });
      }
    }
  }
  console.log(`  marks: ${ASSESS.length} assessments x ${COURSES.length} courses x ${studentIds.length} students`);

  const reviewer = demoFaculty?.id ?? facultyIds[0];
  // from/to are "days ago" (negative = upcoming), so from >= to.
  const LEAVES: Array<{ s: number; type: "medical" | "personal" | "event" | "other"; from: number; to: number; reason: string; status: "pending" | "approved" | "rejected" | "withdrawn"; comment?: string }> = [
    { s: 19, type: "medical", from: 0, to: -2, reason: "Viral fever, doctor advised three days of rest. Certificate will be submitted.", status: "pending" },
    { s: 21, type: "personal", from: -1, to: -3, reason: "Sister's wedding in Mysuru.", status: "pending" },
    { s: 4, type: "event", from: -4, to: -5, reason: "Representing PES at the inter-college hackathon.", status: "pending" },
    { s: 1, type: "event", from: 20, to: 19, reason: "State-level chess tournament, Dharwad.", status: "approved", comment: "Approved. Please collect notes from your section representative." },
    { s: 14, type: "medical", from: 31, to: 29, reason: "Dengue — hospitalised at Manipal Hospital.", status: "approved", comment: "Get well soon. Excused for these dates." },
    { s: 23, type: "personal", from: 12, to: 10, reason: "Family function.", status: "rejected", comment: "Attendance is below 65%; please meet your mentor before applying again." },
    { s: 22, type: "other", from: 8, to: 8, reason: "Two-wheeler licence test at RTO.", status: "rejected", comment: "Not a valid reason for leave during ISA week." },
    { s: 9, type: "personal", from: 15, to: 15, reason: "Bank visit for education loan paperwork.", status: "withdrawn" },
  ];
  for (const [i, l] of LEAVES.entries()) {
    const id = fixedId("1eaf0000", i + 1);
    const fromDate = new Date(dayAgo(base, l.from).toISOString().slice(0, 10));
    const toDate = new Date(dayAgo(base, l.to).toISOString().slice(0, 10));
    const reviewed = l.status === "approved" || l.status === "rejected";
    await prisma.leaveApplication.upsert({
      where: { id },
      update: {},
      create: {
        id,
        studentId: studentIds[l.s],
        leaveType: l.type,
        fromDate,
        toDate,
        reason: l.reason,
        status: l.status,
        reviewedBy: reviewed ? reviewer : null,
        reviewComment: l.comment ?? null,
        reviewedAt: reviewed ? dayAgo(base, Math.max(0, l.to - 1)) : null,
        createdAt: dayAgo(base, l.from + 2),
      },
    });
    if (l.status === "approved") {
      const end = new Date(toDate.getTime() + DAY - 1);
      const sessions = await prisma.session.findMany({
        where: { openedAt: { gte: fromDate, lte: end }, course: { in: COURSES.map((c) => c.code) } },
        select: { id: true },
      });
      for (const s of sessions) {
        await prisma.attendance.upsert({
          where: { sessionId_studentId: { sessionId: s.id, studentId: studentIds[l.s] } },
          create: { sessionId: s.id, studentId: studentIds[l.s], status: "absent", excused: true },
          update: { excused: true },
        });
      }
    }
  }
  console.log(`  leave: ${LEAVES.length} applications (pending, approved, rejected, withdrawn)`);

  const appealTargets = [18, 20, 16];
  for (const [i, s] of appealTargets.entries()) {
    const sid = studentIds[s];
    const attendedIds = new Set(
      // Real entries only: counting the appeal's own excused row would shift this pick on re-run.
      (
        await prisma.attendance.findMany({
          where: { studentId: sid, sessionId: { in: sessionIds.CS304 }, NOT: { status: "absent" } },
          select: { sessionId: true },
        })
      ).map((a) => a.sessionId)
    );
    const missed = sessionIds.CS304.filter((x) => !attendedIds.has(x)).at(-1);
    if (!missed) continue;
    const approved = i === 2;
    await prisma.leaveRequest.upsert({
      where: { studentId_sessionId: { studentId: sid, sessionId: missed } },
      update: {},
      create: {
        studentId: sid,
        sessionId: missed,
        reason: [
          "I was in class but the GPS showed me outside the room — my phone's location was off by 200 m.",
          "Face scan kept failing in the low light near the back bench; I told the professor during class.",
          "I was at the NSS blood donation camp organised by the college.",
        ][i],
        status: approved ? "approved" : "pending",
        reviewedBy: approved ? reviewer : null,
        reviewedAt: approved ? dayAgo(base, 1) : null,
        reviewComment: approved ? "Verified with the NSS coordinator." : null,
      },
    });
    if (approved) {
      await prisma.attendance.upsert({
        where: { sessionId_studentId: { sessionId: missed, studentId: sid } },
        create: { sessionId: missed, studentId: sid, status: "absent", excused: true },
        update: { excused: true },
      });
    }
  }
  console.log(`  appeals: ${appealTargets.length} on CS304 (2 pending, 1 approved)`);

  const nameOf = (i: number) => STUDENTS[i][0];
  const NOTES: Array<{ s: number; type: "leave_approved" | "leave_rejected" | "appeal_approved" | "general"; title: string; body: string; ago: number }> = [
    { s: 1, type: "leave_approved", title: "Leave approved", body: `${nameOf(1)}'s event leave was approved. Comment: Approved. Please collect notes from your section representative.`, ago: 19 },
    { s: 14, type: "leave_approved", title: "Leave approved", body: `${nameOf(14)}'s medical leave was approved. Comment: Get well soon. Excused for these dates.`, ago: 29 },
    { s: 23, type: "leave_rejected", title: "Leave rejected", body: `${nameOf(23)}'s personal leave was rejected. Comment: Attendance is below 65%; please meet your mentor before applying again.`, ago: 10 },
    { s: 22, type: "leave_rejected", title: "Leave rejected", body: `${nameOf(22)}'s leave was rejected. Comment: Not a valid reason for leave during ISA week.`, ago: 8 },
    { s: 16, type: "appeal_approved", title: "Appeal approved", body: `${nameOf(16)}'s appeal for CS304 was approved. Comment: Verified with the NSS coordinator.`, ago: 1 },
    { s: 0, type: "general", title: "ISA-2 marks published", body: "Your ISA-2 marks for CS301 Data Structures are now available under Results.", ago: 3 },
  ];
  for (const [i, n] of NOTES.entries()) {
    await prisma.notification.upsert({
      where: { id: fixedId("707e0000", i + 1) },
      update: { userId: studentIds[n.s], title: n.title, body: n.body },
      create: { id: fixedId("707e0000", i + 1), userId: studentIds[n.s], type: n.type, title: n.title, body: n.body, read: i % 3 === 0, createdAt: dayAgo(base, n.ago) },
    });
  }
  const created = await runAttendanceNotificationCheck(null);
  console.log(`  notifications: ${NOTES.length} decisions/general + ${created} new low-attendance alerts`);

  const adminId = admin?.id ?? null;
  const HISTORY: Array<{ actor: string | null; role: string; action: string; entity: string; summary: string; ago: number; after?: object; before?: object }> = [
    { actor: adminId, role: "admin", action: "import_students", entity: "student", summary: "Import: 24 created, 0 updated, 0 skipped, 0 errored.", ago: 60, after: { created: 24, updated: 0, skipped: 0, errors: 0 } },
    { actor: adminId, role: "admin", action: "import_courses", entity: "course", summary: "Import: 4 created, 0 updated, 0 skipped, 0 errored.", ago: 60, after: { created: 4 } },
    { actor: adminId, role: "admin", action: "import_enrollments", entity: "enrollment", summary: "Import: 96 created, 0 updated, 0 skipped, 0 errored.", ago: 59, after: { created: 96 } },
    { actor: facultyIds[0], role: "faculty", action: "open_session", entity: "session", summary: "Opened CS301 in Room B-204.", ago: 3 },
    { actor: facultyIds[0], role: "faculty", action: "close_session", entity: "session", summary: "Closed CS301 session.", ago: 3, before: { closedAt: null } },
    { actor: facultyIds[1], role: "faculty", action: "import_marks", entity: "marks", summary: "Bulk marks for CS302 ISA-2: 24 saved, 0 skipped.", ago: 5, after: { course: "CS302", assessment: "ISA-2", saved: 24 } },
    { actor: reviewer, role: "faculty", action: "approve_leave", entity: "leave_application", summary: `Approved ${nameOf(1)}'s leave, excused 2 session(s).`, ago: 19, before: { status: "pending" }, after: { status: "approved" } },
    { actor: reviewer, role: "faculty", action: "reject_leave", entity: "leave_application", summary: `Rejected ${nameOf(23)}'s leave.`, ago: 10, before: { status: "pending" }, after: { status: "rejected" } },
    { actor: facultyIds[0], role: "faculty", action: "import_attendance", entity: "attendance", summary: "Import: 0 created, 2 updated, 0 skipped, 0 errored.", ago: 7, after: { updated: 2 } },
    { actor: adminId, role: "admin", action: "reset_password", entity: "user", summary: `Reset password for ${nameOf(8)}.`, ago: 4 },
    { actor: adminId, role: "admin", action: "update_course", entity: "course", summary: "Updated course CS303 (Computer Networks).", ago: 12, before: { credits: 4 }, after: { credits: 3 } },
    { actor: studentIds[19], role: "student", action: "submit_leave", entity: "leave_application", summary: "Submitted medical leave.", ago: 2 },
  ];
  for (const [i, h] of HISTORY.entries()) {
    await prisma.auditLog.upsert({
      where: { id: fixedId("a0d17000", i + 1) },
      update: {},
      create: {
        id: fixedId("a0d17000", i + 1),
        actorId: h.actor,
        actorRole: h.role,
        action: h.action,
        entity: h.entity,
        summary: h.summary,
        before: h.before ?? undefined,
        after: h.after ?? undefined,
        createdAt: dayAgo(base, h.ago),
      },
    });
  }
  console.log(`  audit: ${HISTORY.length} historical entries`);
}
