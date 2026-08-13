
import { api } from "./api-client";


export const ELIGIBILITY_THRESHOLD = 75;


export const STATUS_WEIGHTS = {
  present: 1,
  late: 0.5,
  partial: 0.5,
  absent: 0,
} as const;


export interface AttendanceSummaryRow {
  student_id: string;
  course_code: string;
  course_name: string;
  credits: number;
  semester: string;
  conducted: number;
  present_cnt: number;
  late_cnt: number;
  partial_cnt: number;
  absent_cnt: number;
  
  official_pct: number | null;
  weighted_pct: number | null;
}


export function attendedCount(r: AttendanceSummaryRow): number {
  return r.present_cnt + r.late_cnt + r.partial_cnt;
}


export function isEligible(officialPct: number | null): boolean {
  if (officialPct === null || Number.isNaN(officialPct)) return false;
  return officialPct >= ELIGIBILITY_THRESHOLD;
}

export type SessionOutcomeStatus =
  | "present"
  | "late"
  | "partial"
  | "absent"
  | "missing";


export interface SessionOutcome {
  status: SessionOutcomeStatus;
  
  excused?: boolean;
}

export interface EligibilityCounts {
  
  conducted: number;
  
  attended: number;
  excused: number;
  officialPct: number | null;
  weightedPct: number | null;
}


export function countEligibility(outcomes: SessionOutcome[]): EligibilityCounts {
  let conducted = 0;
  let attended = 0;
  let excused = 0;
  let weightedSum = 0;

  for (const o of outcomes) {
    if (o.excused) {
      excused += 1;
      continue;
    }
    conducted += 1;
    const status = o.status === "missing" ? "absent" : o.status;
    const w = STATUS_WEIGHTS[status] ?? 0;
    weightedSum += w;
    if (status === "present" || status === "late" || status === "partial") {
      attended += 1;
    }
  }

  const officialPct =
    conducted === 0
      ? null
      : Math.round((10000 * attended) / conducted) / 100;
  const weightedPct =
    conducted === 0
      ? null
      : Math.round((10000 * weightedSum) / conducted) / 100;

  return { conducted, attended, excused, officialPct, weightedPct };
}


export function classesNeededForEligibility(
  attended: number,
  conducted: number,
  threshold: number = ELIGIBILITY_THRESHOLD
): number {
  if (!Number.isFinite(attended) || !Number.isFinite(conducted)) return 0;
  if (attended < 0 || conducted < 0) return 0;
  if (conducted === 0) return 0;

  const t = threshold / 100;
  if (t <= 0) return 0;
  if (attended / conducted >= t) return 0;
  if (t >= 1) {
    return attended === conducted ? 0 : Number.POSITIVE_INFINITY;
  }

  const raw = (t * conducted - attended) / (1 - t);
  return Math.max(0, Math.ceil(raw - 1e-9));
}


export function formatPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "No data";
  return `${n.toFixed(2)}%`;
}

export interface StudentSummary {
  
  coursesWithData: number;
  
  eligibleCourses: number;
  
  shortfallCourses: AttendanceSummaryRow[];
  
  worstCourse: AttendanceSummaryRow | null;
  
  anyShortfall: boolean;
  
  overallOfficialPct: number | null;
}


export function summarizeStudent(rows: AttendanceSummaryRow[]): StudentSummary {
  const withData = rows.filter((r) => r.conducted > 0);

  const shortfallCourses = withData
    .filter((r) => !isEligible(r.official_pct))
    .sort((a, b) => (a.official_pct ?? 0) - (b.official_pct ?? 0));

  const worstCourse =
    withData.length === 0
      ? null
      : withData.reduce((worst, r) =>
          (r.official_pct ?? 0) < (worst.official_pct ?? 0) ? r : worst
        );

  const totalConducted = withData.reduce((s, r) => s + r.conducted, 0);
  const totalAttended = withData.reduce((s, r) => s + attendedCount(r), 0);
  const overallOfficialPct =
    totalConducted === 0
      ? null
      : Math.round((10000 * totalAttended) / totalConducted) / 100;

  return {
    coursesWithData: withData.length,
    eligibleCourses: withData.filter((r) => isEligible(r.official_pct)).length,
    shortfallCourses,
    worstCourse,
    anyShortfall: shortfallCourses.length > 0,
    overallOfficialPct,
  };
}

function toNum(v: unknown): number {
  return typeof v === "string" ? Number(v) : (v as number);
}

function normalizeRow(raw: Record<string, unknown>): AttendanceSummaryRow {
  return {
    student_id: String(raw.student_id),
    course_code: String(raw.course_code),
    course_name: String(raw.course_name),
    credits: toNum(raw.credits),
    semester: String(raw.semester),
    conducted: toNum(raw.conducted),
    present_cnt: toNum(raw.present_cnt),
    late_cnt: toNum(raw.late_cnt),
    partial_cnt: toNum(raw.partial_cnt),
    absent_cnt: toNum(raw.absent_cnt),
    official_pct: raw.official_pct == null ? null : toNum(raw.official_pct),
    weighted_pct: raw.weighted_pct == null ? null : toNum(raw.weighted_pct),
  };
}


export async function fetchStudentAttendance(
  studentId: string,
  semester?: string
): Promise<AttendanceSummaryRow[]> {
  const qs = new URLSearchParams({ studentId });
  if (semester) qs.set("semester", semester);
  const { rows } = await api.get<{ rows: Record<string, unknown>[] }>(
    `/attendance-summary?${qs.toString()}`
  );
  return (rows ?? []).map(normalizeRow);
}


export async function fetchCourseAttendance(
  courseCode: string
): Promise<AttendanceSummaryRow[]> {
  const { rows } = await api.get<{ rows: Record<string, unknown>[] }>(
    `/attendance-summary?courseCode=${encodeURIComponent(courseCode)}`
  );
  return (rows ?? []).map(normalizeRow);
}


export async function fetchAllAttendance(): Promise<AttendanceSummaryRow[]> {
  const { rows } = await api.get<{ rows: Record<string, unknown>[] }>("/attendance-summary");
  return (rows ?? []).map(normalizeRow);
}

export interface CourseRollup {
  course_code: string;
  course_name: string;
  credits: number;
  semester: string;
  enrolled: number;
  
  withData: number;
  belowThreshold: number;
  
  avgOfficialPct: number | null;
}


export function rollupByCourse(rows: AttendanceSummaryRow[]): CourseRollup[] {
  const byCourse = new Map<string, AttendanceSummaryRow[]>();
  for (const r of rows) {
    const list = byCourse.get(r.course_code);
    if (list) list.push(r);
    else byCourse.set(r.course_code, [r]);
  }

  const rollups: CourseRollup[] = [];
  for (const [code, list] of byCourse) {
    const withData = list.filter((r) => r.conducted > 0);
    const avgOfficialPct =
      withData.length > 0
        ? Math.round(
            (withData.reduce((s, r) => s + (r.official_pct ?? 0), 0) /
              withData.length) *
              100
          ) / 100
        : null;
    rollups.push({
      course_code: code,
      course_name: list[0].course_name,
      credits: list[0].credits,
      semester: list[0].semester,
      enrolled: list.length,
      withData: withData.length,
      belowThreshold: withData.filter((r) => !isEligible(r.official_pct)).length,
      avgOfficialPct,
    });
  }
  return rollups.sort(
    (a, b) => (a.avgOfficialPct ?? 200) - (b.avgOfficialPct ?? 200)
  );
}


export async function fetchStudentSemesters(studentId: string): Promise<string[]> {
  const rows = await fetchStudentAttendance(studentId);
  const seen = new Set<string>();
  for (const row of rows) seen.add(row.semester);
  return [...seen].sort();
}
