
import { prisma } from "../config/db";
import { hashPassword } from "../services/auth";

const PASSWORD = "Pes@12345";

interface DemoUser {
  email: string;
  fullName: string;
  role: "student" | "faculty" | "admin";
  rollNo: string | null;
}

const USERS: DemoUser[] = [
  { email: "student@pesu.pes.edu", fullName: "Demo Student", role: "student", rollNo: "PES1UG24CA001" },
  { email: "faculty@pesu.pes.edu", fullName: "Demo Faculty", role: "faculty", rollNo: null },
  { email: "admin@pesu.pes.edu", fullName: "Demo Admin", role: "admin", rollNo: null },
  { email: "student@pesu.pesu.pes.edu", fullName: "Demo Student 2", role: "student", rollNo: "PES1UG24CA002" },
  { email: "faculty@pesu.pesu.pes.edu", fullName: "Demo Faculty 2", role: "faculty", rollNo: null },
  { email: "admin@pesu.pesu.pes.edu", fullName: "Demo Admin 2", role: "admin", rollNo: null },
];

async function ensureUsers() {
  const passwordHash = await hashPassword(PASSWORD);
  for (const u of USERS) {
    const id = crypto.randomUUID();
    await prisma.authUser.upsert({
      where: { email: u.email },
      update: {},
      create: { id, email: u.email, passwordHash },
    });
    const user = await prisma.authUser.findUnique({ where: { email: u.email } });
    if (!user) continue;
    await prisma.profile.upsert({
      where: { id: user.id },
      update: { fullName: u.fullName, role: u.role, rollNo: u.rollNo },
      create: { id: user.id, fullName: u.fullName, role: u.role, rollNo: u.rollNo },
    });
    console.log(`  user ${u.email} (${u.role}) â€” password ${PASSWORD}`);
  }
}

async function ensureGeofence() {
  const room = await prisma.geofence.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: { roomName: "Room B-204", lat: 12.9351, lng: 77.5358, radiusM: 100 },
    create: { id: "00000000-0000-0000-0000-000000000001", roomName: "Room B-204", lat: 12.9351, lng: 77.5358, radiusM: 100 },
  });
  console.log(`  geofence ${room.roomName}`);
  return room;
}

interface CourseSeed {
  code: string;
  name: string;
  credits: number;
  semester: string;
  conducted: number;
  attended: number;
  late: number;
  partial: number;
}

const COURSES: CourseSeed[] = [
  { code: "UQ24CA221B", name: "Personality Development", credits: 2.0, semester: "Sem-4", conducted: 34, attended: 26, late: 2, partial: 0 },
  { code: "SEM4-CRYPTO", name: "Cryptography", credits: 4.0, semester: "Sem-4", conducted: 30, attended: 18, late: 2, partial: 0 },
  { code: "SEM4-SE", name: "Software Engineering", credits: 4.0, semester: "Sem-4", conducted: 28, attended: 26, late: 1, partial: 0 },
  { code: "SEM4-ANIM", name: "Animation", credits: 3.0, semester: "Sem-4", conducted: 24, attended: 20, late: 0, partial: 1 },
  { code: "SEM4-JAVA", name: "Java Technologies", credits: 4.0, semester: "Sem-4", conducted: 32, attended: 22, late: 1, partial: 1 },
  { code: "SEM4-EIE2", name: "Essentials of Innovation & Entrepreneurship-II", credits: 2.0, semester: "Sem-4", conducted: 20, attended: 18, late: 0, partial: 0 },
];

const ASSESSMENTS: Array<["ISA-1" | "ISA-2" | "Assignment" | "ESA", number, number]> = [
  ["ISA-1", 34, 40],
  ["ISA-2", 32, 40],
  ["Assignment", 18, 20],
  ["ESA", 80, 100],
];

async function ensureCourses() {
  for (const c of COURSES) {
    await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, credits: c.credits, semester: c.semester },
      create: { code: c.code, name: c.name, credits: c.credits, semester: c.semester },
    });
  }
  console.log(`  ${COURSES.length} courses`);
}

async function ensureEnrollmentsAndSessions(fenceId: string) {
  const students = await prisma.profile.findMany({ where: { role: "student" } });
  const faculty = await prisma.profile.findFirst({ where: { role: "faculty" } });
  if (!faculty) {
    console.warn("  no faculty user â€” skipping sessions + attendance");
    return;
  }

  for (const c of COURSES) {
    for (const s of students) {
      await prisma.enrollment.upsert({
        where: { studentId_courseCode: { studentId: s.id, courseCode: c.code } },
        update: {},
        create: { studentId: s.id, courseCode: c.code, enrolledAt: new Date(Date.now() - 200 * 86_400_000) },
      });
    }
    for (let n = 1; n <= c.conducted; n++) {
      const openedAt = new Date(Date.now() - (c.conducted - n) * 2 * 86_400_000 - 20 * 86_400_000);
      const closedAt = new Date(openedAt.getTime() + 50 * 60_000);
      await prisma.session.upsert({
        where: { id: `${c.code}-${n}`.padEnd(36, "0").slice(0, 36) },
        update: {},
        create: {
          id: `${c.code}-${n}`.padEnd(36, "0").slice(0, 36),
          course: c.code,
          facultyId: faculty.id,
          geofenceId: fenceId,
          openedAt,
          closedAt,
        },
      });
    }
    students.forEach(async (s, idx) => {
      const attendedAdj = Math.max(c.late + c.partial, c.attended - idx * 3);
      for (let n = 1; n <= c.conducted; n++) {
        if (n > attendedAdj) continue;
        const sessionId = `${c.code}-${n}`.padEnd(36, "0").slice(0, 36);
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session) continue;
        const status: "present" | "late" | "partial" =
          n <= attendedAdj - c.late - c.partial
            ? "present"
            : n <= attendedAdj - c.partial
            ? "late"
            : "partial";
        await prisma.attendance.upsert({
          where: { sessionId_studentId: { sessionId, studentId: s.id } },
          update: {},
          create: {
            sessionId,
            studentId: s.id,
            entryTime: new Date(session.openedAt.getTime() + 2 * 60_000),
            exitTime: session.closedAt,
            status,
          },
        });
      }
    });
  }
  console.log(`  enrollments + sessions + attendance for ${COURSES.length} courses Ã— ${students.length} students`);
}

async function ensureMarks() {
  const faculty = await prisma.profile.findFirst({ where: { role: "faculty" } });
  const students = await prisma.profile.findMany({ where: { role: "student" } });
  if (!faculty) return;
  for (const [idx, s] of students.entries()) {
    for (const c of COURSES) {
      for (const [name, score, max] of ASSESSMENTS) {
        const adjusted = Math.max(0, score - idx * (max === 100 ? 7 : 2));
        await prisma.marks.upsert({
          where: { studentId_course_assessment: { studentId: s.id, course: c.code, assessment: name } },
          update: { score: adjusted, maxScore: max, updatedBy: faculty.id, updatedAt: new Date() },
          create: { studentId: s.id, course: c.code, assessment: name, score: adjusted, maxScore: max, updatedBy: faculty.id },
        });
      }
    }
  }
  console.log(`  marks for ${students.length} students Ã— ${COURSES.length} courses`);
}

async function ensureRichProfile() {
  const demoStudent = await prisma.authUser.findUnique({ where: { email: "student@pesu.pesu.pes.edu" } });
  if (!demoStudent) return;
  await prisma.studentDetails.upsert({
    where: { studentId: demoStudent.id },
    update: {},
    create: {
      studentId: demoStudent.id,
      pesuId: "PES2UG24CS118",
      branch: "Computer Applications",
      section: "B",
      dob: new Date("2006-03-14"),
      bloodGroup: "O+",
      sslcPct: 92.8,
      pucPct: 88.4,
      fatherName: "Ramesh Kumar",
      fatherPhone: "+91 98450 11223",
      motherName: "Lakshmi Devi",
      motherPhone: "+91 98450 44556",
      address: "#42, 4th Cross, Jayanagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560041",
      aadhaarLast4: "4821",
    },
  });
  console.log("  rich student_details for the demo student");
}

async function ensureGpsSettings() {
  await prisma.gpsSettings.upsert({
    where: { id: true },
    update: {},
    create: { id: true, accuracyGraceM: 25, lateAfterMin: 10, highAccuracy: true },
  });
}

async function main() {
  console.log("Seeding demo dataâ€¦");
  await ensureUsers();
  const fence = await ensureGeofence();
  await ensureCourses();
  await ensureEnrollmentsAndSessions(fence.id);
  await ensureMarks();
  await ensureRichProfile();
  await ensureGpsSettings();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
