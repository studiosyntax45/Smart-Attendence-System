
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpenCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Target,
  History,
} from "lucide-react";

import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import {
  fetchStudentAttendance,
  fetchStudentSemesters,
  summarizeStudent,
  isEligible,
  formatPct,
  attendedCount,
  classesNeededForEligibility,
  ELIGIBILITY_THRESHOLD,
  type AttendanceSummaryRow,
} from "@/lib/attendance";
import {
  canAppealStatus,
  type LeaveStatus,
} from "@/lib/leave-requests";
import { KpiCard } from "@/components/kpi-card";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { AttendanceRing } from "@/components/charts/attendance-ring";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { ExportMenu } from "@/components/export-menu";
import { StatusPill } from "@/components/status-pill";
import { AppealControl } from "@/components/attendance/appeal-button";
import type { ExportColumn, ExportRow } from "@/lib/export";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, type AttendanceStatus } from "@/lib/utils";


function barTone(officialPct: number | null): string {
  if (officialPct === null) return "bg-muted-foreground/40";
  return isEligible(officialPct) ? "bg-status-present" : "bg-status-absent";
}

interface HistoryRow {
  sessionId: string;
  course: string;
  openedAt: string;
  status: AttendanceStatus | null;
  excused: boolean;
  leaveStatus: LeaveStatus | null;
}

export default function StudentAttendance() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const sem = searchParams.get("sem") ?? undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-attendance", profile?.id, sem ?? null],
    enabled: !!profile,
    queryFn: async () => {
      const semesters = await fetchStudentSemesters(profile!.id);
      const selected =
        sem && semesters.includes(sem) ? sem : semesters[0] ?? null;
      const rows: AttendanceSummaryRow[] = selected
        ? await fetchStudentAttendance(profile!.id, selected)
        : [];

      const enrollmentsRes = await api.get<{ enrollments: Array<{ courseCode: string; active: boolean }> }>(`/enrollments?studentId=${profile!.id}`);
      const courseCodes = (enrollmentsRes.enrollments ?? [])
        .filter((e) => e.active)
        .map((e) => e.courseCode);

      let history: HistoryRow[] = [];
      if (courseCodes.length > 0) {
        const [sessionsRes, attRes, leaveRes] = await Promise.all([
          api.get<{ sessions: Array<{ id: string; course: string; openedAt: string; closedAt: string | null }> }>("/sessions"),
          api.get<{ attendance: Array<{ sessionId: string; status: AttendanceStatus; excused?: boolean }> }>(`/attendance?studentId=${profile!.id}`),
          api.get<{ leaveRequests: Array<{ sessionId: string; status: LeaveStatus }> }>(`/leave-requests?studentId=${profile!.id}`),
        ]);

        const closedSessions = (sessionsRes.sessions ?? []).filter(
          (s) => s.closedAt && courseCodes.includes(s.course)
        );

        const attMap = new Map<string, { status: AttendanceStatus; excused: boolean }>();
        for (const a of attRes.attendance ?? []) {
          attMap.set(a.sessionId, { status: a.status, excused: !!a.excused });
        }

        const leaveMap = new Map<string, LeaveStatus>();
        for (const l of leaveRes.leaveRequests ?? []) {
          leaveMap.set(l.sessionId, l.status);
        }

        history = closedSessions.map((s) => {
          const att = attMap.get(s.id);
          return {
            sessionId: s.id,
            course: s.course,
            openedAt: s.openedAt,
            status: att?.status ?? null,
            excused: att?.excused ?? false,
            leaveStatus: leaveMap.get(s.id) ?? null,
          };
        });
      }

      return { semesters, selected, rows, history };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load your attendance.")}
        reset={() => refetch()}
      />
    );

  const { semesters, selected, rows, history } = data;
  const summary = summarizeStudent(rows);
  const withData = rows.filter((r) => r.conducted > 0);
  const totalConducted = withData.reduce((s, r) => s + r.conducted, 0);
  const totalAttended = withData.reduce((s, r) => s + attendedCount(r), 0);
  const overallNeeded = classesNeededForEligibility(
    totalAttended,
    totalConducted,
    ELIGIBILITY_THRESHOLD
  );
  const worst = summary.worstCourse;
  const worstNeeded = worst
    ? classesNeededForEligibility(
        attendedCount(worst),
        worst.conducted,
        ELIGIBILITY_THRESHOLD
      )
    : 0;

  const exportColumns: ExportColumn[] = [
    { key: "course", label: "Course" },
    { key: "code", label: "Code" },
    { key: "credits", label: "Credits" },
    { key: "attended", label: "Attended" },
    { key: "conducted", label: "Conducted" },
    { key: "official", label: "Official %" },
    { key: "weighted", label: "Weighted %" },
    { key: "status", label: "Status" },
  ];
  const exportRows: ExportRow[] = rows.map((r) => ({
    course: r.course_name,
    code: r.course_code,
    credits: Number(r.credits),
    attended: r.conducted === 0 ? "" : attendedCount(r),
    conducted: r.conducted,
    official: r.official_pct ?? "",
    weighted: r.weighted_pct ?? "",
    status:
      r.conducted === 0
        ? "No data"
        : isEligible(r.official_pct)
          ? "Eligible"
          : "Shortfall",
  }));

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="My Attendance" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {profile.rollNo && (
              <span className="font-mono">{profile.rollNo} Ã‚Â· </span>
            )}
            Per-subject attendance and 75% eligibility
          </p>
        </div>

        {semesters.length > 0 && (
          <div
            className="inline-flex rounded-lg border bg-muted/40 p-1"
            role="tablist"
            aria-label="Semester"
          >
            {semesters.map((s) => (
              <Link
                key={s}
                to={`/student/attendance?sem=${encodeURIComponent(s)}`}
                role="tab"
                aria-selected={s === selected}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  s === selected
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            You are not enrolled in any courses yet. Once your faculty
            enrolls you, your per-subject attendance appears here.
          </CardContent>
        </Card>
      ) : (
        <>
          {summary.anyShortfall ? (
            <div
              className="flex items-start gap-3 rounded-lg border border-status-absent/30 bg-status-absent/10 px-4 py-3"
              role="status"
            >
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-status-absent"
                aria-hidden="true"
              />
              <div className="text-sm">
                <p className="font-semibold text-status-absent">
                  Not eligible in {summary.shortfallCourses.length} subject
                  {summary.shortfallCourses.length > 1 ? "s" : ""}
                </p>
                <p className="text-muted-foreground">
                  Below 75% in{" "}
                  {summary.shortfallCourses.map((r) => r.course_name).join(", ")}.
                  Attend upcoming classes to recover.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="flex items-start gap-3 rounded-lg border border-status-present/30 bg-status-present/10 px-4 py-3"
              role="status"
            >
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-status-present"
                aria-hidden="true"
              />
              <div className="text-sm">
                <p className="font-semibold text-status-present">
                  Eligible in every subject
                </p>
                <p className="text-muted-foreground">
                  You meet the 75% requirement across all {selected} courses.
                </p>
              </div>
            </div>
          )}

          <section className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-0">
                <CardTitle>Overall Ã¢â‚¬â€ {selected}</CardTitle>
                <CardDescription>Attended of conducted, all subjects</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center pb-6 pt-4">
                <AttendanceRing
                  pct={summary.overallOfficialPct}
                  attended={totalAttended}
                  held={totalConducted}
                />
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3 lg:col-span-3">
              <KpiCard
                label="Subjects"
                value={String(rows.length)}
                countTo={rows.length}
                sub={`${selected}`}
                icon={<Layers />}
              />
              <KpiCard
                label="Eligible"
                value={`${summary.eligibleCourses}/${summary.coursesWithData}`}
                sub="At or above 75%"
                icon={<CheckCircle2 />}
                tone={summary.anyShortfall ? "late" : "present"}
              />
              <KpiCard
                label="Shortfall"
                value={String(summary.shortfallCourses.length)}
                countTo={summary.shortfallCourses.length}
                sub="Below 75%"
                icon={<AlertTriangle />}
                tone={summary.anyShortfall ? "absent" : "present"}
              />
            </div>
          </section>

          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Target Attendance Calculator
              </CardTitle>
              <CardDescription>
                Classes you still need to attend (with no further misses) to
                reach {ELIGIBILITY_THRESHOLD}%. Excused sessions are already
                excluded from both counts.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Overall
                </p>
                <p className="mt-1 font-display text-2xl font-semibold">
                  {totalConducted === 0
                    ? "Ã¢â‚¬â€"
                    : !Number.isFinite(overallNeeded)
                      ? "Unreachable"
                      : overallNeeded === 0
                        ? "On track"
                        : `${overallNeeded} more`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalAttended}/{totalConducted} counted
                  {summary.overallOfficialPct != null
                    ? ` Ã‚Â· ${formatPct(summary.overallOfficialPct)}`
                    : ""}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Worst subject
                  {worst ? ` Ã¢â‚¬â€ ${worst.course_code}` : ""}
                </p>
                <p className="mt-1 font-display text-2xl font-semibold">
                  {!worst || worst.conducted === 0
                    ? "Ã¢â‚¬â€"
                    : !Number.isFinite(worstNeeded)
                      ? "Unreachable"
                      : worstNeeded === 0
                        ? "On track"
                        : `${worstNeeded} more`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {worst
                    ? `${attendedCount(worst)}/${worst.conducted} Ã‚Â· ${formatPct(worst.official_pct)}`
                    : "No data yet"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <BookOpenCheck
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Subjects Ã¢â‚¬â€ {selected}
                </CardTitle>
                <CardDescription>
                  Official % gates the 75% requirement; weighted % counts
                  late/left-early as half. Excused sessions are excluded.
                </CardDescription>
              </div>
              <ExportMenu
                filename={`attendance-${profile.rollNo ?? "me"}-${selected}`}
                title={`Attendance Ã¢â‚¬â€ ${selected}`}
                subtitle={`${profile.fullName}${profile.rollNo ? ` Ã‚Â· ${profile.rollNo}` : ""}`}
                columns={exportColumns}
                rows={exportRows}
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Credits</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Attended</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Official %</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Weighted %</th>
                      <th scope="col" className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.course_code}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium">{r.course_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {r.course_code}
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">
                          {Number(r.credits)}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                          {r.conducted === 0
                            ? "Ã¢â‚¬â€"
                            : `${attendedCount(r)}/${r.conducted}`}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-14 font-mono text-xs tabular-nums">
                              {formatPct(r.official_pct)}
                            </span>
                            <div
                              className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
                              aria-hidden="true"
                            >
                              <div
                                className={cn("h-full rounded-full", barTone(r.official_pct))}
                                style={{ width: `${r.official_pct ?? 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                          {formatPct(r.weighted_pct)}
                        </td>
                        <td className="py-3">
                          <EligibilityBadge officialPct={r.official_pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Session history
              </CardTitle>
              <CardDescription>
                Appeal absent, late, or left-early records. Approved appeals
                mark the session excused without changing the original status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No closed sessions yet for your enrolled courses.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                        <th scope="col" className="py-2 font-medium">Appeal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => {
                        const displayStatus: AttendanceStatus =
                          h.status ?? "absent";
                        const appealable =
                          !h.excused &&
                          canAppealStatus(h.status, false) &&
                          !h.leaveStatus;
                        return (
                          <tr
                            key={h.sessionId}
                            className="border-b transition-colors last:border-0 hover:bg-muted/50"
                          >
                            <td className="py-2.5 pr-4 font-medium">
                              {h.course}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs">
                              {new Date(h.openedAt).toLocaleString([], {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-2.5 pr-4">
                              <StatusPill
                                status={displayStatus}
                                excused={h.excused}
                              />
                            </td>
                            <td className="py-2.5">
                              {appealable ? (
                                <AppealControl sessionId={h.sessionId} />
                              ) : (
                                <AppealControl
                                  sessionId={h.sessionId}
                                  leaveStatus={
                                    h.excused
                                      ? "approved"
                                      : h.leaveStatus
                                  }
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </GsapReveal>
  );
}
