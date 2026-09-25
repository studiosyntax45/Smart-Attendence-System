import { api } from "./api-client.ts";

export type LeaveType = "medical" | "personal" | "event" | "other";
export type LeaveAppStatus = "pending" | "approved" | "rejected" | "withdrawn";

export const LEAVE_TYPES: Array<{ value: LeaveType; label: string }> = [
  { value: "medical", label: "Medical" },
  { value: "personal", label: "Personal" },
  { value: "event", label: "College event / competition" },
  { value: "other", label: "Other" },
];

export interface LeaveApplication {
  id: string;
  studentId: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveAppStatus;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  student?: { fullName: string; rollNo: string | null } | null;
  reviewer?: { fullName: string } | null;
}

export interface LeaveForm {
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
}

/** Mirrors the server's schema. */
export function validateLeaveForm(f: LeaveForm): string | null {
  if (!LEAVE_TYPES.some((t) => t.value === f.leaveType)) return "Choose a leave type.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fromDate)) return "Choose a from date.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.toDate)) return "Choose a to date.";
  if (f.toDate < f.fromDate) return "To date cannot be before from date.";
  const reason = f.reason.trim();
  if (reason.length < 5) return "Reason must be at least 5 characters.";
  if (reason.length > 500) return "Reason can be at most 500 characters.";
  return null;
}

/** Inclusive day count, e.g. 2026-09-24 to 2026-09-24 is 1 day. */
export function leaveDays(fromDate: string, toDate: string): number {
  const ms = Date.parse(`${toDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${fromDate.slice(0, 10)}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export const listLeaveApplications = (status?: LeaveAppStatus) =>
  api
    .get<{ leaveApplications: LeaveApplication[] }>(`/leave-applications${status ? `?status=${status}` : ""}`)
    .then((r) => r.leaveApplications);

export const createLeaveApplication = (f: LeaveForm) =>
  api.post<{ leaveApplication: LeaveApplication }>("/leave-applications", { ...f, reason: f.reason.trim() });

export const withdrawLeaveApplication = (id: string) =>
  api.post<{ message: string }>(`/leave-applications/${id}/withdraw`);

export const reviewLeaveApplication = (id: string, decision: "approved" | "rejected", comment?: string) =>
  api.post<{ message: string }>(`/leave-applications/${id}/review`, {
    decision,
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  });
