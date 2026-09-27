import { z } from "zod";
import { config } from "../config/env";

export const ATTENDANCE_TARGET = 75;
export const MARKS_TARGET = 70;

export type Source = "qwen" | "fallback";
export type SubjectStatus = "on_track" | "attendance" | "marks" | "at_risk" | "no_data";

export interface SubjectMetrics {
  course: string;
  courseName: string;
  attendancePct: number | null;
  conducted: number;
  attended: number;
  marksPct: number | null;
  /** Assessment averages, weakest first. */
  assessments: Array<{ name: string; pct: number }>;
}

export interface SubjectInsight extends SubjectMetrics {
  status: SubjectStatus;
  /** Consecutive classes needed to get back to the attendance target; 0 when already there. */
  classesToTarget: number;
  insight: string;
  action: string;
}

export interface OverallFeedback {
  priority: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  actions: string[];
}

export interface StudentInsight {
  source: Source;
  attendancePct: number | null;
  marksPct: number | null;
  overall: OverallFeedback;
  subjects: SubjectInsight[];
}

export interface ClassMetrics {
  course: string;
  courseName: string;
  students: number;
  sessionsHeld: number;
  attendancePct: number | null;
  marksPct: number | null;
  belowAttendance: number;
  belowMarks: number;
  /** Class average per assessment, weakest first. */
  assessments: Array<{ name: string; pct: number; count: number }>;
}

export interface ClassInsight {
  source: Source;
  summary: string;
  focusAreas: string[];
  actions: string[];
}

const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

export function classesToTarget(attended: number, conducted: number): number {
  if (conducted === 0 || (100 * attended) / conducted >= ATTENDANCE_TARGET) return 0;
  // Each extra attended class raises both counts by one.
  const t = ATTENDANCE_TARGET / 100;
  return Math.ceil((t * conducted - attended) / (1 - t));
}

export function subjectStatus(s: Pick<SubjectMetrics, "attendancePct" | "marksPct">): SubjectStatus {
  const lowAtt = s.attendancePct !== null && s.attendancePct < ATTENDANCE_TARGET;
  const lowMarks = s.marksPct !== null && s.marksPct < MARKS_TARGET;
  if (s.attendancePct === null && s.marksPct === null) return "no_data";
  if (lowAtt && lowMarks) return "at_risk";
  if (lowAtt) return "attendance";
  if (lowMarks) return "marks";
  return "on_track";
}

function ruleSubject(s: SubjectMetrics): SubjectInsight {
  const status = subjectStatus(s);
  const need = classesToTarget(s.attended, s.conducted);
  const weakest = s.assessments[0];
  const weakestText = weakest ? `${weakest.name} (${weakest.pct}%)` : null;
  const catchUp = need > 0 ? `Attend the next ${need} ${s.courseName} class${need === 1 ? "" : "es"} without a break to reach ${ATTENDANCE_TARGET}%.` : "";
  let insight: string;
  let action: string;
  switch (status) {
    case "no_data":
      insight = "No closed sessions or marks recorded yet.";
      action = "Check back after the first classes and assessment.";
      break;
    case "at_risk":
      insight = `Attendance (${s.attendancePct}%) and marks (${s.marksPct}%) are both below target.`;
      action = `${catchUp} ${weakestText ? `Revise ${weakestText} with your faculty.` : "Meet your faculty to plan revision."}`.trim();
      break;
    case "attendance":
      insight = `Attendance is ${s.attendancePct}%, below the ${ATTENDANCE_TARGET}% eligibility line${s.marksPct !== null ? `, although marks are fine (${s.marksPct}%)` : ""}.`;
      action = catchUp;
      break;
    case "marks":
      insight = `Marks average ${s.marksPct}%, below ${MARKS_TARGET}%${weakestText ? `; the weakest is ${weakestText}` : ""}.`;
      action = weakestText
        ? `Rework ${weakest!.name}: practise past questions and ask your faculty about the gaps.`
        : "Practise past questions and ask your faculty about the gaps.";
      break;
    default:
      insight =
        s.marksPct === null
          ? `Attendance is on track (${s.attendancePct}%); no marks recorded yet.`
          : s.attendancePct === null
            ? `Marks are on track (${s.marksPct}%); no closed sessions yet.`
            : `On track: attendance ${s.attendancePct}%, marks ${s.marksPct}%.`;
      action =
        weakest && weakest.pct < 85
          ? `Keep it up; ${weakestText} has the most room to improve.`
          : "Keep your current routine.";
  }
  return { ...s, status, classesToTarget: need, insight, action };
}

function ruleOverall(attendancePct: number | null, marksPct: number | null, subjects: SubjectInsight[]): OverallFeedback {
  const behind = subjects.filter((s) => s.status !== "on_track" && s.status !== "no_data");
  const onTrack = subjects.filter((s) => s.status === "on_track");
  if (attendancePct === null && marksPct === null) {
    return {
      priority: "Record enough attendance and marks data for a meaningful analysis.",
      summary: "Not enough attendance or marks data is available for personalised guidance yet.",
      strengths: [],
      concerns: [],
      actions: ["Check again after your next classes and assessment."],
    };
  }
  const worst = behind.find((s) => s.status === "at_risk") ?? behind[0];
  return {
    priority: worst ? `${worst.courseName}: ${worst.action}` : "Maintain your consistent attendance and study routine.",
    summary: behind.length
      ? `${behind.length} of ${subjects.length} subjects need attention: ${behind.map((s) => s.courseName).join(", ")}.`
      : `All ${subjects.length} subjects are on track.`,
    strengths: onTrack.slice(0, 3).map((s) => `${s.courseName} is on track.`),
    concerns: behind.slice(0, 3).map((s) => `${s.courseName}: ${s.insight}`),
    actions: behind.length ? behind.slice(0, 3).map((s) => s.action) : ["Keep attending and revising at your current pace."],
  };
}

function ruleClass(m: ClassMetrics): ClassInsight {
  const weakest = m.assessments[0];
  const focusAreas: string[] = [];
  if (m.belowAttendance > 0) focusAreas.push(`${m.belowAttendance} of ${m.students} students are below ${ATTENDANCE_TARGET}% attendance.`);
  if (m.belowMarks > 0) focusAreas.push(`${m.belowMarks} of ${m.students} students average below ${MARKS_TARGET}% in marks.`);
  if (weakest && weakest.pct < MARKS_TARGET) focusAreas.push(`The class averaged ${weakest.pct}% in ${weakest.name}, the weakest assessment.`);
  const actions: string[] = [];
  if (weakest && weakest.pct < MARKS_TARGET) actions.push(`Revisit the topics from ${weakest.name} in class and share worked solutions.`);
  if (m.belowAttendance > 0) actions.push("Follow up with the students below 75% before they lose eligibility.");
  if (m.belowMarks > 0) actions.push("Offer a doubt-clearing session for the students below 70%.");
  return {
    source: "fallback",
    summary:
      m.attendancePct === null && m.marksPct === null
        ? "No closed sessions or marks recorded for this course yet."
        : `Class attendance averages ${m.attendancePct ?? "—"}% and marks average ${m.marksPct ?? "—"}% across ${m.students} students.`,
    focusAreas: focusAreas.length ? focusAreas : ["No major gaps: attendance and marks are on target."],
    actions: actions.length ? actions : ["Keep the current pace; recheck after the next assessment."],
  };
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** One JSON chat call to the local model. Returns null on any failure so callers fall back to rules. */
async function askModel<T>(system: string, user: unknown, schema: z.ZodType<T>, numPredict: number, fetcher: Fetcher = fetch): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ollama.timeoutMs);
  try {
    const response = await fetcher(`${config.ollama.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ollama.model,
        stream: false,
        format: { type: "object" },
        options: { temperature: 0.2, num_predict: numPredict },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(user) },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { message?: { content?: unknown } };
    if (typeof payload.message?.content !== "string") return null;
    const parsed = schema.safeParse(JSON.parse(payload.message.content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const line = (max: number) => z.string().min(1).max(max);
const studentSchema = z.object({
  priority: line(220),
  summary: line(500),
  strengths: z.array(line(200)).max(3),
  concerns: z.array(line(220)).max(3),
  actions: z.array(line(240)).min(1).max(3),
  subjects: z.array(z.object({ course: line(40), insight: line(260), action: line(260) })).max(20),
});

const STUDENT_PROMPT =
  "You are a supportive academic coach for a college student. Use only the supplied metrics and course names; never invent scores, trends or subjects. " +
  `Targets: attendance ${ATTENDANCE_TARGET}% (exam eligibility), marks ${MARKS_TARGET}%. ` +
  "Return JSON with: priority (the single most important next step, one sentence), summary (one or two encouraging, specific sentences), " +
  "strengths and concerns (at most three short items each), actions (two or three concrete steps with a frequency or time commitment), " +
  "and subjects: one entry per supplied course code with course (the code), insight (one sentence on where the student stands in that subject, citing its numbers) " +
  "and action (one concrete next step for that subject; if classesToTarget > 0 mention attending that many classes). " +
  "If a subject is on track, say so and suggest how to keep it there instead of inventing a problem.";

export async function buildStudentInsight(
  subjectsIn: SubjectMetrics[],
  options: { enabled?: boolean; fetcher?: Fetcher } = {}
): Promise<StudentInsight> {
  const subjects = subjectsIn.map(ruleSubject);
  const conducted = subjects.reduce((n, s) => n + s.conducted, 0);
  const attended = subjects.reduce((n, s) => n + s.attended, 0);
  const attendancePct = conducted > 0 ? clamp((100 * attended) / conducted) : null;
  const withMarks = subjects.filter((s) => s.marksPct !== null);
  const marksPct = withMarks.length ? clamp(withMarks.reduce((n, s) => n + s.marksPct!, 0) / withMarks.length) : null;
  const base: StudentInsight = { source: "fallback", attendancePct, marksPct, overall: ruleOverall(attendancePct, marksPct, subjects), subjects };

  const enabled = options.enabled ?? config.ollama.enabled;
  const hasData = subjects.some((s) => s.status !== "no_data");
  if (!enabled || !hasData) return base;

  const ai = await askModel(
    STUDENT_PROMPT,
    {
      overall: { attendancePct, marksPct },
      subjects: subjects.map((s) => ({
        course: s.course,
        name: s.courseName,
        attendancePct: s.attendancePct,
        marksPct: s.marksPct,
        status: s.status,
        classesToTarget: s.classesToTarget,
        weakestAssessments: s.assessments.slice(0, 2),
      })),
    },
    studentSchema,
    220 + 90 * subjects.length,
    options.fetcher
  );
  if (!ai) return base;

  // Status stays rule-based; the model only words the explanation. Unknown courses are ignored.
  const byCourse = new Map(ai.subjects.map((s) => [s.course.trim().toUpperCase(), s]));
  return {
    source: "qwen",
    attendancePct,
    marksPct,
    overall: { priority: ai.priority, summary: ai.summary, strengths: ai.strengths, concerns: ai.concerns, actions: ai.actions },
    subjects: subjects.map((s) => {
      const hit = byCourse.get(s.course.toUpperCase());
      return hit ? { ...s, insight: hit.insight, action: hit.action } : s;
    }),
  };
}

const classSchema = z.object({
  summary: line(500),
  focusAreas: z.array(line(240)).min(1).max(4),
  actions: z.array(line(240)).min(1).max(4),
});

const CLASS_PROMPT =
  "You advise a college teacher about one course. Use only the supplied class metrics; never invent numbers or topics beyond the assessment names given. " +
  `Targets: attendance ${ATTENDANCE_TARGET}%, marks ${MARKS_TARGET}%. ` +
  "Return JSON with summary (two sentences on how the class is doing and where it is behind), focusAreas (up to four specific gaps, citing numbers) " +
  "and actions (up to four concrete teaching steps the teacher can take this week).";

export async function buildClassInsight(m: ClassMetrics, options: { enabled?: boolean; fetcher?: Fetcher } = {}): Promise<ClassInsight> {
  const base = ruleClass(m);
  const enabled = options.enabled ?? config.ollama.enabled;
  if (!enabled || (m.attendancePct === null && m.marksPct === null)) return base;
  const ai = await askModel(CLASS_PROMPT, m, classSchema, 420, options.fetcher);
  return ai ? { source: "qwen", ...ai } : base;
}
