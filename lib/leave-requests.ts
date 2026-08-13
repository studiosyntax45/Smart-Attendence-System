
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
    return { message: "Appeal submitted â€” pending faculty review." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit appeal." };
  }
}


export async function listPendingLeaveRequests(facultyId?: string): Promise<LeaveRequest[]> {
  try {
    const path = facultyId
      ? `/leave-requests?mine=true&facultyId=${encodeURIComponent(facultyId)}`
      : "/leave-requests?mine=true";
    const { leaveRequests } = await api.get<{ leaveRequests: LeaveRequest[] }>(path);
    return leaveRequests ?? [];
  } catch (err) {
    if (err instanceof Error) throw new Error(err.message);
    throw new Error("Failed to list pending leave requests.");
  }
}


export async function reviewLeaveRequest(
  id: string,
  decision: "approved" | "rejected"
): Promise<LeaveActionState> {
  if (!id) return { error: "Missing leave request id." };
  if (decision !== "approved" && decision !== "rejected") {
    return { error: "Decision must be approved or rejected." };
  }
  try {
    const { message } = await api.post<{ message: string }>(`/leave-requests/${id}/review`, { decision });
    return { message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to review appeal." };
  }
}


export async function listMyLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    const { leaveRequests } = await api.get<{ leaveRequests: LeaveRequest[] }>("/leave-requests?mine=true");
    return leaveRequests ?? [];
  } catch (err) {
    if (err instanceof Error) throw new Error(err.message);
    throw new Error("Failed to list your leave requests.");
  }
}
