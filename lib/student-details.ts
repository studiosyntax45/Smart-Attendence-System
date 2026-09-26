import { api } from "./api-client";

/** One student's details as the API returns them (Decimal columns arrive as strings). */
export interface StudentDetails {
  pesuId: string | null;
  branch: string | null;
  section: string | null;
  year: number | null;
  parentEmail: string | null;
  dob: string | null;
  bloodGroup: string | null;
  sslcPct: string | number | null;
  pucPct: string | number | null;
  fatherName: string | null;
  fatherPhone: string | null;
  motherName: string | null;
  motherPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  aadhaarLast4: string | null;
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export interface StudentListRow {
  id: string;
  fullName: string;
  rollNo: string | null;
  email: string | null;
  branch: string | null;
  section: string | null;
  year: number | null;
  personalFilled: boolean;
}

/** Faculty and admin only. */
export async function listStudents(): Promise<StudentListRow[]> {
  const res = await api.get<{ students: StudentListRow[] }>("/student-details");
  return res.students;
}

export async function getStudentDetails(studentId: string): Promise<StudentDetails | null> {
  const res = await api.get<{ details: StudentDetails | null }>(`/student-details/${studentId}`);
  return res.details;
}

/** Faculty and admin only. Empty strings clear a field. */
export async function saveStudentDetails(studentId: string, details: Partial<StudentDetails>): Promise<StudentDetails> {
  const res = await api.put<{ details: StudentDetails }>(`/student-details/${studentId}`, details);
  return res.details;
}

export function pctOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** DOB is stored as a UTC date; format it in UTC so no time zone shifts it by a day. */
export function formatDob(dob: string | null | undefined): string | null {
  if (!dob) return null;
  return new Date(dob).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** "2004-03-15T00:00:00.000Z" -> "2004-03-15" for <input type="date">. */
export function dobInputValue(dob: string | null | undefined): string {
  return dob ? dob.slice(0, 10) : "";
}

const PERSONAL_FIELDS: (keyof StudentDetails)[] = [
  "dob",
  "bloodGroup",
  "sslcPct",
  "pucPct",
  "fatherName",
  "fatherPhone",
  "motherName",
  "motherPhone",
  "address",
  "pincode",
  "aadhaarLast4",
];

/** True when none of the personal fields are filled (import only sets branch/section/year). */
export function personalDetailsMissing(d: StudentDetails | null): boolean {
  return !d || PERSONAL_FIELDS.every((k) => d[k] === null || d[k] === "");
}
