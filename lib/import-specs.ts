import type { ImportSpec } from "./bulk-import.ts";
import { norm } from "./csv.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["present", "late", "absent", "partial"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "mon", "Monday", "TUE" -> "Mon"; anything else is returned unchanged so the check can reject it. */
const normalizeDay = (v: string) => DAYS.find((d) => v.toLowerCase().startsWith(d.toLowerCase()) && /^[a-z]+$/i.test(v)) ?? v;
/** "9:00" -> "09:00". */
const normalizeTime = (v: string) => (/^\d:\d{2}$/.test(v) ? `0${v}` : v);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const usnKnown = (v: string, ctx: { knownUsns: Set<string> }) =>
  ctx.knownUsns.has(norm(v)) ? undefined : `USN ${v} not found among students.`;
const courseKnown = (v: string, ctx: { knownCourses: Set<string> }) =>
  ctx.knownCourses.has(v.toUpperCase()) ? undefined : `CourseCode ${v.toUpperCase()} does not exist.`;

export const IMPORT_SPECS = {
  students: {
    id: "students",
    title: "Students",
    templateName: "students_template.csv",
    keyColumn: "usn",
    columns: [
      { key: "usn", label: "USN", aliases: ["usn", "srn", "rollno", "prn"], required: true },
      { key: "name", label: "Name", aliases: ["name", "studentname", "fullname"], required: true },
      {
        key: "email",
        label: "Email",
        aliases: ["email", "collegeemail"],
        required: true,
        check: (v) => (EMAIL.test(v) ? undefined : `"${v}" is not a valid email.`),
      },
      { key: "branch", label: "Branch", aliases: ["branch", "department"], required: false, hint: "CSE, ECE…" },
      {
        key: "year",
        label: "Year",
        aliases: ["year"],
        required: false,
        check: (v) => (/^[1-6]$/.test(v) ? undefined : "Year must be a number from 1 to 6."),
      },
      { key: "section", label: "Section", aliases: ["section", "sec"], required: false },
      {
        key: "parentEmail",
        label: "ParentEmail",
        aliases: ["parentemail", "parent"],
        required: false,
        check: (v) => (EMAIL.test(v) ? undefined : `"${v}" is not a valid parent email.`),
      },
    ],
    sample: [
      ["USN", "Name", "Email", "Branch", "Year", "Section", "ParentEmail"],
      ["PES1UG23CS101", "Rahul Kumar", "rahul.k@pesu.pes.edu", "CSE", "3", "A", "parent.rahul@gmail.com"],
      ["PES1UG23CS102", "Priya Sharma", "priya.s@pesu.pes.edu", "CSE", "3", "A", "parent.priya@gmail.com"],
    ],
    warn: (v, ctx) => (ctx.knownUsns.has(norm(v.usn)) ? ["Existing USN — this row will update the student."] : []),
  },
  courses: {
    id: "courses",
    title: "Courses",
    templateName: "courses_template.csv",
    keyColumn: "code",
    columns: [
      {
        key: "code",
        label: "CourseCode",
        aliases: ["coursecode", "code"],
        required: true,
        check: (v) => (/^[A-Za-z0-9-]{2,20}$/.test(v) ? undefined : "Code must be 2-20 letters, digits or hyphens (no spaces)."),
      },
      { key: "name", label: "CourseName", aliases: ["coursename", "name", "title"], required: true },
      {
        key: "credits",
        label: "Credits",
        aliases: ["credits", "credit"],
        required: true,
        check: (v) => {
          const n = Number(v);
          return Number.isFinite(n) && n >= 0 && n <= 10 ? undefined : "Credits must be a number from 0 to 10.";
        },
      },
      { key: "semester", label: "Semester", aliases: ["semester", "sem"], required: true, hint: "e.g. Sem-5" },
    ],
    sample: [
      ["CourseCode", "CourseName", "Credits", "Semester"],
      ["CS301", "Data Structures", "4", "Sem-5"],
      ["CS302", "Database Systems", "4", "Sem-5"],
    ],
    dedupKey: (v) => v.code.toUpperCase(),
    warn: (v, ctx) => (ctx.knownCourses.has(v.code.toUpperCase()) ? ["Existing course — this row will update it."] : []),
  },
  enrollments: {
    id: "enrollments",
    title: "Enrollments",
    templateName: "enrollments_template.csv",
    keyColumn: "usn",
    columns: [
      { key: "usn", label: "USN", aliases: ["usn", "srn", "rollno"], required: true, check: usnKnown },
      { key: "courseCode", label: "CourseCode", aliases: ["coursecode", "course", "code"], required: true, check: courseKnown },
    ],
    sample: [
      ["USN", "CourseCode"],
      ["PES1UG23CS101", "CS301"],
      ["PES1UG23CS102", "CS301"],
    ],
    dedupKey: (v) => `${norm(v.usn)}|${v.courseCode.toUpperCase()}`,
  },
  attendance: {
    id: "attendance",
    title: "Attendance corrections",
    templateName: "attendance_template.csv",
    keyColumn: "usn",
    columns: [
      { key: "usn", label: "USN", aliases: ["usn", "srn", "rollno"], required: true, check: usnKnown },
      { key: "courseCode", label: "CourseCode", aliases: ["coursecode", "course", "code"], required: true, check: courseKnown },
      {
        key: "date",
        label: "Date",
        aliases: ["date", "sessiondate"],
        required: true,
        hint: "YYYY-MM-DD",
        check: (v) => (DATE.test(v) && !Number.isNaN(Date.parse(v)) ? undefined : "Date must be YYYY-MM-DD."),
      },
      {
        key: "status",
        label: "Status",
        aliases: ["status"],
        required: true,
        hint: STATUSES.join(" / "),
        check: (v) => (STATUSES.includes(v.toLowerCase()) ? undefined : `Status must be one of ${STATUSES.join(", ")}.`),
      },
    ],
    sample: [
      ["USN", "CourseCode", "Date", "Status"],
      ["PES1UG23CS101", "CS301", "2026-09-24", "PRESENT"],
      ["PES1UG23CS102", "CS301", "2026-09-24", "LATE"],
    ],
    dedupKey: (v) => `${norm(v.usn)}|${v.courseCode.toUpperCase()}|${v.date}`,
  },
  faculty: {
    id: "faculty",
    title: "Faculty",
    templateName: "faculty_template.csv",
    keyColumn: "email",
    columns: [
      { key: "name", label: "Name", aliases: ["name", "fullname", "facultyname"], required: true },
      {
        key: "email",
        label: "Email",
        aliases: ["email", "collegeemail"],
        required: true,
        normalize: (v) => v.toLowerCase(),
        check: (v, ctx) => {
          if (!EMAIL.test(v)) return `"${v}" is not a valid email.`;
          const role = ctx.knownEmails?.get(v);
          return role && role !== "faculty" ? `${v} already belongs to a ${role} account.` : undefined;
        },
      },
    ],
    sample: [
      ["Name", "Email"],
      ["Dr. Meera Iyer", "meera.iyer@pesu.pes.edu"],
      ["Prof. Arvind Kumar", "arvind.kumar@pesu.pes.edu"],
    ],
    warn: (v, ctx) => (ctx.knownFaculty?.has(v.email) ? ["Existing faculty — this row will update the name."] : []),
  },
  timetable: {
    id: "timetable",
    title: "Timetable",
    templateName: "timetable_template.csv",
    keyColumn: "facultyEmail",
    columns: [
      {
        key: "day",
        label: "Day",
        aliases: ["day", "dayofweek", "weekday"],
        required: true,
        hint: "Mon … Sat",
        normalize: normalizeDay,
        check: (v) => (DAYS.includes(v) ? undefined : `Day must be a weekday name like Mon or Monday.`),
      },
      {
        key: "start",
        label: "Start",
        aliases: ["start", "starttime", "from"],
        required: true,
        hint: "HH:MM",
        normalize: normalizeTime,
        check: (v) => (TIME.test(v) ? undefined : "Start must be a 24-hour time like 09:00."),
      },
      {
        key: "end",
        label: "End",
        aliases: ["end", "endtime", "to"],
        required: true,
        hint: "HH:MM",
        normalize: normalizeTime,
        check: (v) => (TIME.test(v) ? undefined : "End must be a 24-hour time like 10:00."),
      },
      { key: "courseCode", label: "CourseCode", aliases: ["coursecode", "course", "code"], required: true, check: courseKnown },
      {
        key: "facultyEmail",
        label: "FacultyEmail",
        aliases: ["facultyemail", "faculty", "teacher", "email"],
        required: true,
        normalize: (v) => v.toLowerCase(),
        check: (v, ctx) => (ctx.knownFaculty?.has(v) ? undefined : `No faculty account with email ${v}.`),
      },
      {
        key: "room",
        label: "Room",
        aliases: ["room", "classroom", "geofence"],
        required: true,
        check: (v, ctx) => (ctx.knownRooms?.has(v.toLowerCase()) ? undefined : `Room "${v}" is not a configured geofence.`),
      },
      {
        key: "class",
        label: "Class",
        aliases: ["class", "section", "classname"],
        required: false,
        hint: "e.g. CSE Sem-5 A",
        check: (v, ctx) => (ctx.knownClasses?.has(v.toLowerCase()) ? undefined : `Class "${v}" does not exist.`),
      },
    ],
    sample: [
      ["Day", "Start", "End", "CourseCode", "FacultyEmail", "Room", "Class"],
      ["Mon", "09:00", "10:00", "CS301", "kavitha.rao@pesu.pes.edu", "Room B-204", "CSE Sem-5 A"],
      ["Mon", "10:00", "11:00", "CS302", "suresh.nair@pesu.pes.edu", "Room B-204", "CSE Sem-5 A"],
    ],
    rowCheck: (v) => (v.end > v.start ? undefined : { field: "end", error: "End time must be after start time." }),
    // Same teacher, day and start time is a clash.
    dedupKey: (v) => `${v.facultyEmail}|${v.day}|${v.start}`,
    duplicateMessage: "This faculty member is already teaching at this day and start time in this file.",
  },
} satisfies Record<string, ImportSpec>;

export type ImportSpecId = keyof typeof IMPORT_SPECS;
