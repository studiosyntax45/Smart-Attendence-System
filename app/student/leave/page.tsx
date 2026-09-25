import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  LEAVE_TYPES,
  createLeaveApplication,
  leaveDays,
  listLeaveApplications,
  validateLeaveForm,
  withdrawLeaveApplication,
  type LeaveForm,
} from "@/lib/leave-applications";
import { listMyLeaveRequests } from "@/lib/leave-requests";
import { LeaveStatusPill } from "@/components/leave-status-pill";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY: LeaveForm = { leaveType: "medical", fromDate: "", toDate: "", reason: "" };
const fmt = (d: string) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

export default function StudentLeavePage() {
  const { profile, parentView } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<LeaveForm>({ ...EMPTY, fromDate: today(), toDate: today() });
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-leave", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [applications, appeals] = await Promise.all([listLeaveApplications(), listMyLeaveRequests()]);
      return { applications, appeals };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["student-leave"] });
    qc.invalidateQueries({ queryKey: ["student-dashboard"] });
  };

  const submit = useMutation({
    mutationFn: () => createLeaveApplication(form),
    onSuccess: () => {
      setForm({ ...EMPTY, fromDate: today(), toDate: today() });
      refresh();
    },
  });
  const withdraw = useMutation({ mutationFn: withdrawLeaveApplication, onSuccess: refresh });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data) return <SectionError error={new Error("Could not load your leave requests.")} reset={() => refetch()} />;

  const days = form.fromDate && form.toDate && form.toDate >= form.fromDate ? leaveDays(form.fromDate, form.toDate) : null;

  return (
    <div className="space-y-6">
      <PageTitle title="Leave & appeals" />
      <div>
        <h1 className="text-2xl font-bold">Leave &amp; appeals</h1>
        <p className="text-sm text-muted-foreground">
          Apply for leave ahead of time, or appeal a specific session from{" "}
          <Link to="/student/attendance" className="font-medium text-primary underline-offset-4 hover:underline">
            My Attendance
          </Link>
          . Approved leave excuses every session in the date range.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {!parentView && (
          <Card>
            <CardHeader>
              <CardTitle>Apply for leave</CardTitle>
              <CardDescription>Your faculty reviews it and you get a notification with the decision.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const err = validateLeaveForm(form);
                  setFormError(err);
                  if (!err) submit.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="leaveType">Leave type</Label>
                  <select
                    id="leaveType"
                    value={form.leaveType}
                    onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="fromDate">From</Label>
                    <Input id="fromDate" type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toDate">To</Label>
                    <Input
                      id="toDate"
                      type="date"
                      min={form.fromDate || undefined}
                      value={form.toDate}
                      onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {days !== null && (
                  <p className="-mt-2 text-xs text-muted-foreground">
                    {days} day{days === 1 ? "" : "s"}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <textarea
                    id="reason"
                    rows={3}
                    maxLength={500}
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="e.g. Viral fever — doctor advised rest"
                    className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-right text-xs text-muted-foreground tabular-nums">{form.reason.trim().length}/500</p>
                </div>
                {(formError || submit.error) && (
                  <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {formError ?? (submit.error as Error).message}
                  </p>
                )}
                {submit.isSuccess && (
                  <p role="status" className="flex items-center gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Leave request sent for review.
                  </p>
                )}
                <Button type="submit" variant="accent" className="w-full" disabled={submit.isPending}>
                  {submit.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                  {submit.isPending ? "Sending…" : "Submit leave request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My leave requests</CardTitle>
              <CardDescription>Pending requests can be withdrawn until they are reviewed.</CardDescription>
            </CardHeader>
            <CardContent>
              {withdraw.error && (
                <p role="alert" className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {(withdraw.error as Error).message}
                </p>
              )}
              {data.applications.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No leave requests yet.</p>
              ) : (
                <ul className="divide-y">
                  {data.applications.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">
                          {LEAVE_TYPES.find((t) => t.value === a.leaveType)?.label ?? a.leaveType} ·{" "}
                          <span className="tabular-nums">
                            {fmt(a.fromDate)}
                            {a.toDate.slice(0, 10) !== a.fromDate.slice(0, 10) && ` – ${fmt(a.toDate)}`}
                          </span>
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({leaveDays(a.fromDate, a.toDate)} day{leaveDays(a.fromDate, a.toDate) === 1 ? "" : "s"})
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">{a.reason}</p>
                        {a.reviewComment && (
                          <p className="text-xs">
                            <span className="text-muted-foreground">Comment from {a.reviewer?.fullName ?? "faculty"}:</span> {a.reviewComment}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <LeaveStatusPill status={a.status} />
                        {a.status === "pending" && !parentView && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={withdraw.isPending}
                            onClick={() => {
                              if (confirm("Withdraw this leave request?")) withdraw.mutate(a.id);
                            }}
                          >
                            Withdraw
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My session appeals</CardTitle>
              <CardDescription>Disputes about a single absent, late or left-early record.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.appeals.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No appeals. Use the Appeal button next to a session on My Attendance.
                </p>
              ) : (
                <ul className="divide-y">
                  {data.appeals.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">
                          {a.session?.course ?? "Session"}
                          {a.session?.opened_at && (
                            <span className="ml-1 font-normal text-muted-foreground tabular-nums">· {fmt(a.session.opened_at)}</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{a.reason}</p>
                        {a.review_comment && (
                          <p className="text-xs">
                            <span className="text-muted-foreground">Comment:</span> {a.review_comment}
                          </p>
                        )}
                      </div>
                      <LeaveStatusPill status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
