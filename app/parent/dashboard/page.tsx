
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { StatusPill } from "@/components/status-pill";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { StudentKpis, useStudentOverview } from "@/components/student-kpis";
import { NotificationList } from "@/components/notification-list";
import { LeaveStatusPill } from "@/components/leave-status-pill";
import { LEAVE_TYPES, leaveDays, listLeaveApplications } from "@/lib/leave-applications";
import { AttendanceRing } from "@/components/charts/attendance-ring";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttendanceStatus } from "@/lib/utils";

interface AttendanceRow {
  id: string;
  entry_time: string;
  exit_time: string | null;
  duration_min: number | null;
  status: AttendanceStatus;
  excused?: boolean;
  sessions: { course: string } | null;
}

interface MarkRow {
  id: string;
  course: string;
  assessment: string;
  score: number;
  max_score: number;
}

export default function ParentDashboard() {
  const { profile } = useAuth();
  const child = profile;
  const overview = useStudentOverview(child?.id);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-dashboard", child?.id],
    enabled: !!child,
    queryFn: async () => {
      const since = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const [attRes, marksRes, sessionsRes] = await Promise.all([
        api.get<{ attendance: Array<{ id: string; entryTime: string; exitTime: string | null; durationMin: number | null; status: AttendanceStatus; excused?: boolean; session?: { course: string } }> }>(`/attendance?studentId=${child!.id}`),
        api.get<{ marks: Array<{ id: string; course: string; assessment: string; score: number; maxScore: number }> }>(`/marks?studentId=${child!.id}`),
        api.get<{ sessions: Array<{ id: string; openedAt: string }> }>("/sessions"),
      ]);

      const attRows: AttendanceRow[] = (attRes.attendance ?? [])
        .filter((a) => a.entryTime >= since)
        .map((a) => ({
          id: a.id,
          entry_time: a.entryTime,
          exit_time: a.exitTime,
          duration_min: a.durationMin,
          status: a.status,
          excused: a.excused,
          sessions: a.session ? { course: a.session.course } : null,
        }));

      const markRows: MarkRow[] = (marksRes.marks ?? []).map((m) => ({
        id: m.id,
        course: m.course,
        assessment: m.assessment,
        score: m.score,
        max_score: m.maxScore,
      }));

      const held = (sessionsRes.sessions ?? []).filter((s) => s.openedAt >= since).length;

      return {
        records: attRows,
        marks: markRows,
        held,
      };
    },
  });

  if (!child || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load the dashboard.")}
        reset={() => refetch()}
      />
    );

  const records = data.records;
  const marks = data.marks;
  const pct = overview.data?.overallPct == null ? null : Math.round(overview.data.overallPct);
  const attended = overview.data?.attended ?? 0;
  const held = overview.data?.conducted ?? 0;

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Parent Dashboard" />
      
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{child.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {child.rollNo && <span className="font-mono">{child.rollNo} · </span>}
            Attendance, results, leave and alerts
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Parent view · read-only
        </span>
      </div>

      
      <StudentKpis studentId={child.id} variant="parent" />

      <section className="grid items-start gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle>Attendance rate</CardTitle>
            <CardDescription>All closed sessions in {child.fullName.split(" ")[0]}&apos;s courses</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center pb-6 pt-4">
            <AttendanceRing pct={pct} attended={attended} held={held} />
          </CardContent>
        </Card>
        <div className="space-y-4 lg:col-span-3">
          <NotificationList readOnly />
          <ParentLeaveStatus />
        </div>
      </section>

      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Marks
          </CardTitle>
          <CardDescription>Recorded by faculty — read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          {marks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No marks recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Assessment</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Score</th>
                    <th scope="col" className="py-2 font-medium">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map((m) => {
                    const mp = Math.round(
                      (Number(m.score) / Number(m.max_score)) * 100
                    );
                    return (
                      <tr
                        key={m.id}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-2.5 pr-4 font-medium">{m.course}</td>
                        <td className="py-2.5 pr-4">{m.assessment}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {Number(m.score)}/{Number(m.max_score)}
                        </td>
                        <td className="py-2.5 font-mono text-xs">{mp}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      
      <Card>
        <CardHeader>
          <CardTitle>Recent attendance</CardTitle>
          <CardDescription>
            Entry, exit and duration per class — newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No attendance records in the last 30 days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Entry</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Exit</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Duration</th>
                    <th scope="col" className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 10).map((r) => (
                    <tr
                      key={r.id}
                      className="border-b transition-colors last:border-0 hover:bg-muted/50"
                    >
                      <td className="py-2.5 pr-4 font-medium">
                        {r.sessions?.course ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {new Date(r.entry_time).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {r.exit_time
                          ? new Date(r.exit_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        {r.duration_min !== null ? `${r.duration_min} min` : "—"}
                      </td>
                      <td className="py-2.5">
                        <StatusPill
                          status={r.status}
                          excused={r.excused === true}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </GsapReveal>
  );
}


function ParentLeaveStatus() {
  const { data, isLoading } = useQuery({ queryKey: ["student-leave-parent"], queryFn: () => listLeaveApplications() });
  const rows = (data ?? []).slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave status</CardTitle>
        <CardDescription>Leave requests and their review outcome.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No leave requests.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((l) => {
              const days = leaveDays(l.fromDate, l.toDate);
              return (
                <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {LEAVE_TYPES.find((t) => t.value === l.leaveType)?.label ?? l.leaveType}
                      <span className="ml-1 font-normal text-muted-foreground tabular-nums">
                        · {new Date(l.fromDate).toLocaleDateString([], { day: "numeric", month: "short" })} · {days} day{days === 1 ? "" : "s"}
                      </span>
                    </p>
                    {l.reviewComment && <p className="text-xs text-muted-foreground">Comment: {l.reviewComment}</p>}
                  </div>
                  <LeaveStatusPill status={l.status} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
