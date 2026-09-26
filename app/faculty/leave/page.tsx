import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, LoaderCircle, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  LEAVE_TYPES,
  leaveDays,
  listLeaveApplications,
  reviewLeaveApplication,
  type LeaveAppStatus,
} from "@/lib/leave-applications";
import { listPendingLeaveRequests } from "@/lib/leave-requests";
import { PendingAppeals } from "@/components/faculty/pending-appeals";
import { LeaveStatusPill } from "@/components/leave-status-pill";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (d: string) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short" });

export default function FacultyLeavePage() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<LeaveAppStatus | "">("pending");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const { data, isPending: isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-leave", status],
    enabled: !!profile,
    queryFn: async () => {
      const [applications, appeals] = await Promise.all([
        listLeaveApplications(status || undefined),
        listPendingLeaveRequests(),
      ]);
      return { applications, appeals };
    },
    placeholderData: (prev) => prev,
  });

  const review = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) =>
      reviewLeaveApplication(v.id, v.decision, comments[v.id]),
    onSuccess: (res) => {
      setMessage(res.message);
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data) return <SectionError error={new Error("Could not load leave requests.")} reset={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageTitle title="Leave & appeals" />
      <div>
        <h1 className="text-2xl font-bold">Leave &amp; appeals</h1>
        <p className="text-sm text-muted-foreground">
          Approving leave excuses the student for every session in those dates; approving an appeal excuses that one session.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Leave requests</CardTitle>
            <CardDescription>{data.applications.length} shown</CardDescription>
          </div>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LeaveAppStatus | "")}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="">All</option>
          </select>
        </CardHeader>
        <CardContent className="space-y-3">
          {message && (
            <p role="status" className="rounded-md bg-status-present/10 p-3 text-sm text-status-present">{message}</p>
          )}
          {review.error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{(review.error as Error).message}</p>
          )}
          {data.applications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {status === "pending" ? "No pending leave requests." : "Nothing here."}
            </p>
          ) : (
            <ul className="space-y-3">
              {data.applications.map((a) => {
                const busy = review.isPending && review.variables?.id === a.id;
                const days = leaveDays(a.fromDate, a.toDate);
                return (
                  <li key={a.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">
                          {a.student?.fullName ?? "Student"}
                          {a.student?.rollNo && <span className="ml-2 font-mono text-xs text-muted-foreground">{a.student.rollNo}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {LEAVE_TYPES.find((t) => t.value === a.leaveType)?.label} · {fmt(a.fromDate)}
                          {days > 1 && ` – ${fmt(a.toDate)}`} · {days} day{days === 1 ? "" : "s"}
                        </p>
                        <p>{a.reason}</p>
                        {a.reviewComment && <p className="text-xs text-muted-foreground">Comment: {a.reviewComment}</p>}
                      </div>
                      <LeaveStatusPill status={a.status} />
                    </div>
                    {a.status === "pending" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          aria-label={`Comment for ${a.student?.fullName ?? "student"}`}
                          placeholder="Comment (optional, sent to the student)"
                          maxLength={400}
                          value={comments[a.id] ?? ""}
                          onChange={(e) => setComments({ ...comments, [a.id]: e.target.value })}
                          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => review.mutate({ id: a.id, decision: "approved" })}>
                          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4 text-status-present" aria-hidden="true" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => review.mutate({ id: a.id, decision: "rejected" })}>
                          <X className="size-4 text-destructive" aria-hidden="true" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <PendingAppeals requests={data.appeals} />
    </div>
  );
}
