import { z } from "zod";
import { config } from "../config/env";

export interface PerformanceInput {
  attendancePct: number | null;
  marksPct: number | null;
  subjects: Array<{ course: string; marksPct: number }>;
}

export interface PerformanceFeedback {
  source: "qwen" | "fallback";
  priority: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  actions: string[];
}

const responseSchema = z.object({
  priority: z.string().min(1).max(180),
  summary: z.string().min(1).max(500),
  strengths: z.array(z.string().min(1).max(180)).max(3),
  concerns: z.array(z.string().min(1).max(180)).max(3),
  actions: z.array(z.string().min(1).max(220)).min(1).max(3),
});

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

function fallbackFeedback(input: PerformanceInput): PerformanceFeedback {
  const attendancePct = input.attendancePct === null ? null : clampPct(input.attendancePct);
  const marksPct = input.marksPct === null ? null : clampPct(input.marksPct);
  if (attendancePct === null || marksPct === null) {
    return {
      source: "fallback",
      priority: "Record enough attendance and marks data for a meaningful analysis.",
      summary: "Not enough attendance or marks data is available for personalised guidance yet.",
      strengths: [],
      concerns: ["Record both attendance and at least one assessment mark."],
      actions: ["Check this insight again after your next assessment is recorded."],
    };
  }

  const goodAttendance = attendancePct >= 75;
  const goodMarks = marksPct >= 70;
  if (goodAttendance && goodMarks) {
    return {
      source: "fallback",
      priority: "Maintain your consistent attendance and study routine.",
      summary: "Excellent performance. Maintain your attendance and continue your current study pattern.",
      strengths: ["Attendance is at or above 75%.", "Average marks are strong."],
      concerns: [],
      actions: ["Maintain your attendance and current study routine."],
    };
  }
  if (!goodAttendance && !goodMarks) {
    return {
      source: "fallback",
      priority: "Improve class attendance while rebuilding your academic foundation.",
      summary: "Your attendance is below the recommended level, which may be affecting your academic performance.",
      strengths: [],
      concerns: ["Attendance is below 75%.", "Average marks need improvement."],
      actions: ["Attend classes regularly.", "Revise lecture notes daily and seek faculty help in weak subjects."],
    };
  }
  if (goodAttendance) {
    return {
      source: "fallback",
      priority: "Turn your strong attendance into better assessment results.",
      summary: "Your attendance is good, but your academic performance needs improvement.",
      strengths: ["Attendance is at or above 75%."],
      concerns: ["Average marks are below 70%."],
      actions: ["Focus on concepts and practise previous question papers.", "Meet your faculty for guidance in weak subjects."],
    };
  }
  return {
    source: "fallback",
    priority: "Raise attendance above 75% to protect your eligibility.",
    summary: "Your marks are currently good, but low attendance may affect future performance and eligibility.",
    strengths: ["Average marks are strong."],
    concerns: ["Attendance is below 75%."],
    actions: ["Improve attendance while maintaining your academic results."],
  };
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function getPerformanceFeedback(
  input: PerformanceInput,
  options: { enabled?: boolean; fetcher?: Fetcher } = {}
): Promise<PerformanceFeedback> {
  const fallback = fallbackFeedback(input);
  const enabled = options.enabled ?? config.ollama.enabled;
  if (!enabled || input.attendancePct === null || input.marksPct === null) return fallback;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const fetcher = options.fetcher ?? fetch;
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), config.ollama.timeoutMs);
    const response = await fetcher(`${config.ollama.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ollama.model,
        stream: false,
        format: { type: "object" },
        options: { temperature: 0.2, num_predict: 350 },
        messages: [
          {
            role: "system",
            content:
              "You are a supportive academic coach for a college student. Use only the supplied metrics and listed course names; never invent scores, trends, diagnoses, or subjects. Return valid JSON only with priority, summary, strengths, concerns, and actions. priority is the single most important next outcome (one sentence). summary is encouraging and specific (one or two sentences). Give at most three concise strengths and concerns. Give two or three actions when there is a concern, each concrete with a frequency or time commitment where possible. If both attendance and marks are good, recommend maintaining the routine rather than creating a problem.",
          },
          {
            role: "user",
            content: JSON.stringify({
              attendancePct: clampPct(input.attendancePct),
              averageMarksPct: clampPct(input.marksPct),
              policy: { recommendedAttendancePct: 75, goodMarksPct: 70 },
              subjectPerformance: input.subjects.slice(0, 8).map((subject) => ({
                course: subject.course,
                averageMarksPct: clampPct(subject.marksPct),
                status: subject.marksPct >= 70 ? "on track" : "needs attention",
              })),
            }),
          },
        ],
      }),
    });
    clearTimeout(timeout);
    timeout = undefined;
    if (!response.ok) return fallback;
    const payload = (await response.json()) as { message?: { content?: unknown } };
    if (typeof payload.message?.content !== "string") return fallback;
    const parsed = responseSchema.safeParse(JSON.parse(payload.message.content));
    return parsed.success ? { source: "qwen", ...parsed.data } : fallback;
  } catch {
    if (timeout) clearTimeout(timeout);
    return fallback;
  }
}
