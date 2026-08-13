
import { api } from "./api-client";

export interface ScheduleActionState {
  error?: string;
  message?: string;
}

export interface ScheduleEntryInput {
  id?: string;
  course: string;
  facultyId: string;
  geofenceId: string;
  classId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleEntry {
  id: string;
  course: string;
  faculty_id: string;
  geofence_id: string;
  class_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at?: string;
  geofences?: { room_name: string } | null;
  profiles?: { full_name: string } | null;
  classes?:
    | { id: string; name: string; branch: string; semester: string; section: string }
    | null;
  faculty?: { id: string; fullName: string } | null;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;


export function normaliseTime(t: string): string | null {
  const raw = t.trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] !== undefined ? Number(m[3]) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}


export function validateScheduleInput(input: ScheduleEntryInput): string | null {
  const course = input.course.trim();
  if (!course) return "Enter a course name.";
  if (!input.facultyId) return "Choose a faculty member.";
  if (!input.geofenceId) return "Choose a classroom geofence.";
  const day = Number(input.dayOfWeek);
  if (!Number.isInteger(day) || day < 0 || day > 6)
    return "Day of week must be between 0 (Sunday) and 6 (Saturday).";
  const start = normaliseTime(input.startTime);
  const end = normaliseTime(input.endTime);
  if (!start) return `Start time "${input.startTime}" is not a valid time.`;
  if (!end) return `End time "${input.endTime}" is not a valid time.`;
  if (start >= end) return "Start time must be before end time.";
  return null;
}


export function filterScheduleByDay(entries: ScheduleEntry[], dayOfWeek: number): ScheduleEntry[] {
  return entries
    .filter((e) => e.day_of_week === dayOfWeek)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}


export function formatTimeRange(start: string, end: string): string {
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  return `${s} â€“ ${e}`;
}


export async function listScheduleForFaculty(
  facultyId: string,
  dayOfWeek: number
): Promise<ScheduleEntry[]> {
  if (!facultyId) return [];
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return [];
  try {
    const { schedule } = await api.get<{ schedule: ScheduleEntry[] }>(
      `/class-schedule?facultyId=${encodeURIComponent(facultyId)}&dayOfWeek=${dayOfWeek}`
    );
    return schedule ?? [];
  } catch (err) {
    console.warn("listScheduleForFaculty:", err);
    return [];
  }
}


export async function listAllSchedule(): Promise<ScheduleEntry[]> {
  try {
    const { schedule } = await api.get<{ schedule: ScheduleEntry[] }>("/class-schedule");
    return schedule ?? [];
  } catch (err) {
    console.warn("listAllSchedule:", err);
    return [];
  }
}


export async function upsertScheduleEntry(input: ScheduleEntryInput): Promise<ScheduleActionState> {
  const validationError = validateScheduleInput(input);
  if (validationError) return { error: validationError };
  try {
    if (input.id) {
      await api.post("/class-schedule", { ...input });
    } else {
      const { id, ...rest } = input;
      void id;
      await api.post("/class-schedule", rest);
    }
    return { message: `Saved schedule entry.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save schedule entry." };
  }
}


export async function deleteScheduleEntry(id: string): Promise<ScheduleActionState> {
  if (!id) return { error: "Missing schedule entry id." };
  try {
    await api.del(`/class-schedule/${id}`);
    return { message: "Schedule entry deleted." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete schedule entry." };
  }
}
