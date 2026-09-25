import { prisma } from "../config/db";

/** Courses a faculty member teaches: ones they have opened sessions for or are timetabled on. */
export async function facultyCourseCodes(facultyId: string): Promise<string[]> {
  const [sessions, slots] = await Promise.all([
    prisma.session.findMany({ where: { facultyId }, distinct: ["course"], select: { course: true } }),
    prisma.classSchedule.findMany({ where: { facultyId }, distinct: ["course"], select: { course: true } }),
  ]);
  return [...new Set([...sessions, ...slots].map((r) => r.course))];
}

/** Attendance read scope: null means unrestricted (admin); faculty see only their own courses. */
export async function courseScope(user: { id: string; role: string }): Promise<string[] | null> {
  return user.role === "faculty" ? facultyCourseCodes(user.id) : null;
}
