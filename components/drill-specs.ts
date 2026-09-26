import type { DrillSpec, ListRow } from "@/components/drilldown";
import { attendedCount, ELIGIBILITY_THRESHOLD, formatPct, WARNING_THRESHOLD, type AttendanceSummaryRow } from "@/lib/attendance";

type List = Extract<DrillSpec, { kind: "list" }>;
const dateTime = (t: string) =>
  new Date(t).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const date = (t: string) => new Date(t).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });

export interface HealthStudent {
  studentId: string;
  fullName: string;
  rollNo: string | null;
  section: string | null;
  attended: number;
  conducted: number;
  pct: number;
  status: string;
}

export function studentsSpec(title: string, students: HealthStudent[], extra: Partial<List> = {}): List {
  return {
    kind: "list",
    title,
    subtitle: "Lowest attendance first. Click a student for courses, marks and leave.",
    columns: [
      { key: "name", label: "Student" },
      { key: "usn", label: "USN" },
      { key: "section", label: "Section" },
      { key: "classes", label: "Attended", numeric: true },
      { key: "pct", label: "Attendance", numeric: true },
      { key: "status", label: "Band" },
    ],
    rows: [...students]
      .sort((a, b) => a.pct - b.pct)
      .map((s) => ({
        _studentId: s.studentId,
        _name: s.fullName,
        _usn: s.rollNo,
        name: s.fullName,
        usn: s.rollNo ?? "—",
        section: s.section ?? "—",
        classes: `${s.attended}/${s.conducted}`,
        pct: s.conducted ? `${s.pct}%` : "—",
        status: s.conducted ? s.status : "no classes yet",
      })),
    ...extra,
  };
}

export interface PendingLeave {
  student?: { fullName: string; rollNo: string | null } | null;
  studentId: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
}
export interface PendingAppeal {
  studentId?: string;
  student_id?: string;
  student?: { fullName?: string; full_name?: string; rollNo?: string | null; roll_no?: string | null } | null;
  session?: { course: string; openedAt?: string; opened_at?: string } | null;
  reason: string;
}

export function pendingLeaveSpec(apps: PendingLeave[], appeals: PendingAppeal[], link?: List["link"]): List {
  const rows: ListRow[] = [
    ...apps.map((a) => ({
      _studentId: a.studentId,
      _name: a.student?.fullName,
      _usn: a.student?.rollNo,
      kind: `Leave (${a.leaveType})`,
      name: a.student?.fullName ?? "—",
      usn: a.student?.rollNo ?? "—",
      when: `${date(a.fromDate)} → ${date(a.toDate)}`,
      reason: a.reason,
    })),
    ...appeals.map((a) => {
      const name = a.student?.fullName ?? a.student?.full_name ?? "—";
      const usn = a.student?.rollNo ?? a.student?.roll_no ?? null;
      const opened = a.session?.openedAt ?? a.session?.opened_at;
      return {
        _studentId: a.studentId ?? a.student_id,
        _name: name,
        _usn: usn,
        kind: `Appeal (${a.session?.course ?? "session"})`,
        name,
        usn: usn ?? "—",
        when: opened ? date(opened) : "—",
        reason: a.reason,
      };
    }),
  ];
  return {
    kind: "list",
    title: "Pending leave and appeals",
    columns: [
      { key: "kind", label: "Type" },
      { key: "name", label: "Student" },
      { key: "usn", label: "USN" },
      { key: "when", label: "When" },
      { key: "reason", label: "Reason" },
    ],
    rows,
    empty: "Nothing waiting for review.",
    link,
  };
}

export interface SessionLite {
  course: string;
  openedAt: string;
  closedAt: string | null;
  geofence?: { roomName: string } | null;
  faculty?: { fullName: string } | null;
}

export function sessionsSpec(title: string, sessions: SessionLite[], extra: Partial<List> = {}): List {
  return {
    kind: "list",
    title,
    columns: [
      { key: "course", label: "Course" },
      { key: "room", label: "Room" },
      { key: "faculty", label: "Faculty" },
      { key: "opened", label: "Opened" },
      { key: "state", label: "State" },
    ],
    rows: [...sessions]
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .map((s) => ({
        course: s.course,
        room: s.geofence?.roomName ?? "—",
        faculty: s.faculty?.fullName ?? "—",
        opened: dateTime(s.openedAt),
        state: s.closedAt ? `Closed ${new Date(s.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Open now",
      })),
    empty: "No sessions.",
    ...extra,
  };
}

export interface RecordLite {
  entryTime: string;
  status: string;
  excused?: boolean;
  studentId?: string;
  student?: { id?: string; fullName: string; rollNo: string | null } | null;
  session?: { course: string } | null;
}

export function recordsSpec(title: string, records: RecordLite[], extra: Partial<List> = {}): List {
  return {
    kind: "list",
    title,
    columns: [
      { key: "name", label: "Student" },
      { key: "usn", label: "USN" },
      { key: "course", label: "Course" },
      { key: "entry", label: "Entry" },
      { key: "status", label: "Status" },
    ],
    rows: records.map((r) => ({
      _studentId: r.student?.id ?? r.studentId,
      _name: r.student?.fullName,
      _usn: r.student?.rollNo,
      name: r.student?.fullName ?? "—",
      usn: r.student?.rollNo ?? "—",
      course: r.session?.course ?? "—",
      entry: r.status === "absent" ? "—" : dateTime(r.entryTime),
      status: r.excused ? "excused" : r.status,
    })),
    empty: "No records.",
    ...extra,
  };
}

export function peopleSpec(title: string, people: Array<{ id: string; name: string; rollNo?: string | null; email?: string | null; role: string }>, students: boolean): List {
  return {
    kind: "list",
    title,
    subtitle: students ? "Click a student for courses, marks and leave." : undefined,
    columns: [
      { key: "name", label: "Name" },
      { key: "id", label: students ? "USN" : "Email" },
    ],
    rows: people.map((p) => ({
      ...(students ? { _studentId: p.id, _name: p.name, _usn: p.rollNo } : {}),
      name: p.name,
      id: (students ? p.rollNo : p.email) ?? "—",
    })),
  };
}

export interface HealthCourseRow extends HealthStudent {
  courseCode: string;
  courseName: string;
}

const band = (pct: number, conducted: number) =>
  conducted === 0 ? "none" : pct >= ELIGIBILITY_THRESHOLD ? "good" : pct >= WARNING_THRESHOLD ? "warning" : "critical";

/** Per-course health rows summed into one row per student. */
export function rollupStudents(rows: HealthCourseRow[]): HealthStudent[] {
  const by = new Map<string, HealthStudent>();
  for (const r of rows) {
    const s = by.get(r.studentId) ?? { ...r, attended: 0, conducted: 0 };
    s.attended += r.attended;
    s.conducted += r.conducted;
    by.set(r.studentId, s);
  }
  return [...by.values()].map((s) => {
    const pct = s.conducted ? Math.round((100 * s.attended) / s.conducted) : 0;
    return { ...s, pct, status: band(pct, s.conducted) };
  });
}

export function courseAveragesSpec(title: string, rows: HealthCourseRow[], extra: Partial<List> = {}): List {
  const by = new Map<string, { name: string; students: number; attended: number; conducted: number }>();
  for (const r of rows) {
    const c = by.get(r.courseCode) ?? { name: r.courseName, students: 0, attended: 0, conducted: 0 };
    c.students += 1;
    c.attended += r.attended;
    c.conducted += r.conducted;
    by.set(r.courseCode, c);
  }
  return {
    kind: "list",
    title,
    columns: [
      { key: "code", label: "Course" },
      { key: "name", label: "Name" },
      { key: "students", label: "Students", numeric: true },
      { key: "classes", label: "Attended", numeric: true },
      { key: "pct", label: "Attendance", numeric: true },
    ],
    rows: [...by.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, c]) => ({
        code,
        name: c.name,
        students: String(c.students),
        classes: `${c.attended}/${c.conducted}`,
        pct: c.conducted ? `${Math.round((100 * c.attended) / c.conducted)}%` : "—",
      })),
    empty: "No closed sessions yet.",
    ...extra,
  };
}

/** One student's courses; each row opens that course's sessions. */
export function studentCoursesSpec(title: string, studentId: string, rows: AttendanceSummaryRow[], extra: Partial<List> = {}): List {
  return {
    kind: "list",
    title,
    subtitle: "Click a course for its sessions.",
    columns: [
      { key: "code", label: "Course" },
      { key: "name", label: "Name" },
      { key: "classes", label: "Attended", numeric: true },
      { key: "pct", label: "Official %", numeric: true },
    ],
    rows: rows.map((r) => ({
      _studentId: studentId,
      _courseCode: r.course_code,
      _name: r.course_name,
      code: r.course_code,
      name: r.course_name,
      classes: r.conducted ? `${attendedCount(r)}/${r.conducted}` : "—",
      pct: formatPct(r.official_pct),
    })),
    empty: "No courses.",
    ...extra,
  };
}

/** Students in one course; each row opens that student's sessions in the course. */
export function courseStudentsSpec(courseCode: string, courseName: string, rows: HealthCourseRow[], extra: Partial<List> = {}): List {
  return {
    kind: "list",
    title: `${courseCode} · ${courseName}`,
    subtitle: "Lowest attendance first. Click a student for their sessions in this course.",
    columns: [
      { key: "name", label: "Student" },
      { key: "usn", label: "USN" },
      { key: "classes", label: "Attended", numeric: true },
      { key: "pct", label: "Attendance", numeric: true },
    ],
    rows: rows
      .filter((r) => r.courseCode === courseCode)
      .sort((a, b) => a.pct - b.pct)
      .map((r) => ({
        _studentId: r.studentId,
        _courseCode: r.courseCode,
        _name: r.courseName,
        name: r.fullName,
        usn: r.rollNo ?? "—",
        classes: `${r.attended}/${r.conducted}`,
        pct: r.conducted ? `${r.pct}%` : "—",
      })),
    empty: "No enrolled students.",
    ...extra,
  };
}
