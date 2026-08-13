
import { gradeForPct, type LetterGrade } from "./results.ts";
import { ELIGIBILITY_THRESHOLD } from "./attendance.ts";


export const MARKS_GOOD_THRESHOLD = 70;


const MARKS_WEIGHT = 0.8;
const ATTENDANCE_WEIGHT = 0.2;

export type Band = "good" | "low";
export type RiskLevel = "Low" | "Medium" | "High";
export type Likelihood = "Low" | "Medium" | "High";

export interface PerformanceInput {
  attendancePct: number | null;
  marksPct: number | null;
}

export interface PerformanceAnalysis {
  attendancePct: number;
  marksPct: number;
  attendanceBand: Band;
  marksBand: Band;
  headline: string;
  feedback: string;
  atRisk: boolean;
}

export interface PerformancePrediction {
  projectedPct: number;
  expectedGrade: LetterGrade;
  riskLevel: RiskLevel;
  improvementProbability: Likelihood;
  recommendedAction: string;
}


function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function attendanceBand(pct: number): Band {
  return pct >= ELIGIBILITY_THRESHOLD ? "good" : "low";
}

function marksBand(pct: number): Band {
  return pct >= MARKS_GOOD_THRESHOLD ? "good" : "low";
}
const RUBRIC: Record<
  string,
  { headline: string; feedback: string; recommendedAction: string }
> = {
  "good-good": {
    headline: "Excellent â€” keep it up",
    feedback:
      "Excellent performance. Maintain your attendance and continue your current study pattern.",
    recommendedAction:
      "Maintain your attendance and current study routine.",
  },
  "good-low": {
    headline: "Strong attendance Â· academics need focus",
    feedback:
      "Your attendance is good, but your academic performance needs improvement. Focus on understanding concepts, practise previous question papers, and meet your faculty for additional guidance.",
    recommendedAction:
      "Prioritise concept revision and past-paper practice; consult faculty in your weakest subjects.",
  },
  "low-low": {
    headline: "Attendance and marks both need attention",
    feedback:
      "Your attendance is below the recommended level, which may be affecting your academic performance. Attend classes regularly, revise lecture notes daily, and seek help from faculty for subjects where your marks are low.",
    recommendedAction:
      "Improve attendance first, then revise daily and seek faculty help in weak subjects.",
  },
  "low-good": {
    headline: "Good marks Â· attendance at risk",
    feedback:
      "Although your marks are currently good, low attendance may impact your future performance and exam eligibility. Try to improve your attendance while maintaining your academic results.",
    recommendedAction:
      "Raise your attendance to stay eligible while keeping your marks up.",
  },
};


export function analyzePerformance(
  input: PerformanceInput
): PerformanceAnalysis | null {
  if (input.attendancePct === null || input.marksPct === null) return null;

  const att = clampPct(input.attendancePct);
  const marks = clampPct(input.marksPct);
  const aBand = attendanceBand(att);
  const mBand = marksBand(marks);
  const rubric = RUBRIC[`${aBand}-${mBand}`];

  return {
    attendancePct: att,
    marksPct: marks,
    attendanceBand: aBand,
    marksBand: mBand,
    headline: rubric.headline,
    feedback: rubric.feedback,
    atRisk: aBand === "low" || mBand === "low",
  };
}


export function predictPerformance(
  input: PerformanceInput
): PerformancePrediction | null {
  if (input.attendancePct === null || input.marksPct === null) return null;

  const att = clampPct(input.attendancePct);
  const marks = clampPct(input.marksPct);
  const projectedPct =
    Math.round((MARKS_WEIGHT * marks + ATTENDANCE_WEIGHT * att) * 100) / 100;
  const { grade } = gradeForPct(projectedPct);

  const aBand = attendanceBand(att);
  const mBand = marksBand(marks);
  let riskLevel: RiskLevel;
  if (projectedPct < 40 || att < 60 || (aBand === "low" && mBand === "low")) {
    riskLevel = "High";
  } else if (aBand === "good" && mBand === "good" && att >= 85) {
    riskLevel = "Low";
  } else {
    riskLevel = "Medium";
  }
  let improvementProbability: Likelihood;
  if (aBand === "good") {
    improvementProbability = "High";
  } else if (mBand === "good") {
    improvementProbability = "Medium";
  } else {
    improvementProbability = "Low";
  }

  return {
    projectedPct,
    expectedGrade: grade,
    riskLevel,
    improvementProbability,
    recommendedAction: RUBRIC[`${aBand}-${mBand}`].recommendedAction,
  };
}
