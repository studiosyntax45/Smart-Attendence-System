import { api } from "./api-client";
import type { AttendanceStatus } from "./utils";

export interface LeaveActionState {
  error?: string;
  message?: string;
}

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  student_id: string;
  session_id: string;
  reason: string;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment?: string | null;
  created_at: string;
  student?: { full_name: string; roll_no: string | null } | null;
  session?: { course: string; opened_at: string; faculty_id: string | null } | null;
}

export const REASON_MIN = 5;
export const REASON_MAX = 500;

export const APPEALABLE_STATUSES: AttendanceStatus[] = ["absent", "late", "partial"];

export function validateLeaveReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < REASON_MIN) return `Reason must be at least ${REASON_MIN} characters.`;
  if (trimmed.length > REASON_MAX) return `Reason must be at most ${REASON_MAX} characters.`;
  return null;
}

export function canAppealStatus(
  status: AttendanceStatus | null | undefined,
  alreadyExcused = false
): boolean {
  if (alreadyExcused) return false;
  if (status == null) return true;
  return APPEALABLE_STATUSES.includes(status);
}

export async function fileLeaveRequest(
  sessionId: string,
  reason: string
): Promise<LeaveActionState> {
  if (!sessionId) return { error: "Missing session." };
  const reasonError = validateLeaveReason(reason);
  if (reasonError) return { error: reasonError };
  try {
    await api.post("/leave-requests", { sessionId, reason: reason.trim() });
    return { message: "Appeal submitted — pending faculty review." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit appeal." };
  }
}

interface ApiLeaveRequest {
  id: string;
  studentId: string;
  sessionId: string;
  reason: string;
  status: LeaveStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment?: string | null;
  createdAt: string;
  student?: { fullName: string; rollNo: string | null } | null;
  session?: { course: string; openedAt: string; facultyId: string | null } | null;
}

export function fromApiLeaveRequest(r: ApiLeaveRequest): LeaveRequest {
  return {
    id: r.id,
    student_id: r.studentId,
    session_id: r.sessionId,
    reason: r.reason,
    status: r.status,
    reviewed_by: r.reviewedBy,
    reviewed_at: r.reviewedAt,
    review_comment: r.reviewComment ?? null,
    created_at: r.createdAt,
    student: r.student ? { full_name: r.student.fullName, roll_no: r.student.rollNo } : null,
    session: r.session
      ? { course: r.session.course, opened_at: r.session.openedAt, faculty_id: r.session.facultyId }
      : null,
  };
}

/** Pending appeals; the server limits faculty to sessions they opened. */
export async function listPendingLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    const { leaveRequests } = await api.get<{ leaveRequests: ApiLeaveRequest[] }>("/leave-requests");
    return (leaveRequests ?? []).filter((r) => r.status === "pending").map(fromApiLeaveRequest);
  } catch (err) {
    if (err instanceof Error) throw new Error(err.message);
    throw new Error("Failed to list pending leave requests.");
  }
}

export async function reviewLeaveRequest(
  id: string,
  decision: "approved" | "rejected",
  comment?: string
): Promise<LeaveActionState> {
  if (!id) return { error: "Missing leave request id." };
  if (decision !== "approved" && decision !== "rejected") {
    return { error: "Decision must be approved or rejected." };
  }
  try {
    const { message } = await api.post<{ message: string }>(`/leave-requests/${id}/review`, {
      decision,
      ...(comment?.trim() ? { comment: comment.trim() } : {}),
    });
    return { message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to review appeal." };
  }
}

export async function listMyLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    const { leaveRequests } = await api.get<{ leaveRequests: ApiLeaveRequest[] }>("/leave-requests?mine=true");
    return (leaveRequests ?? []).map(fromApiLeaveRequest);
  } catch (err) {
    if (err instanceof Error) throw new Error(err.message);
    throw new Error("Failed to list your leave requests.");
  }
}
