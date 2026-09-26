import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Award, CalendarCheck2, CalendarX2, Clock, FileClock, Percent, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { fetchStudentAttendance, isEligible, summarizeStudent, WARNING_THRESHOLD } from "@/lib/attendance";
import { computeCgpa, computeCourseResults, type CourseMeta, type MarkRow } from "@/lib/results";
import { KpiCard } from "@/components/kpi-card";
import { useAuth } from "@/lib/auth";
import type { DrillSpec } from "@/components/drilldown";
import { pendingLeaveSpec, recordsSpec, type PendingAppeal, type PendingLeave, type RecordLite } from "@/components/drill-specs";
import { Skeleton } from "@/components/ui/skeleton";

/** Uses the server summary, so sessions a student never joined count as missed. */
export function useStudentOverview(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-overview", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const [summaryRows, attRes, marksRes, coursesRes, leaveApps, appeals] = await Promise.all([
        fetchStudentAttendance(studentId!),
        api.get<{ attendance: Array<RecordLite & { excused: boolean }> }>(`/attendance?studentId=${studentId}`),
        api.get<{ marks: Array<{ course: string; assessment: string; score: number; maxScore: number }> }>(`/marks?studentId=${studentId}`),
        api.get<{ courses: CourseMeta[] }>("/courses"),
        api.get<{ leaveApplications: Array<PendingLeave & { status: string }> }>("/leave-applications"),
        api.get<{ leaveRequests: Array<PendingAppeal & { status: string }> }>("/leave-requests?mine=true"),
      ]);

      const summary = summarizeStudent(summaryRows);
      const withData = summaryRows.filter((r) => r.conducted > 0);
      const conducted = withData.reduce((n, r) => n + r.conducted, 0);
      const attended = withData.reduce((n, r) => n + r.present_cnt + r.late_cnt + r.partial_cnt, 0);
      const late = withData.reduce((n, r) => n + r.late_cnt, 0);

      const markRows: MarkRow[] = marksRes.marks.map((m) => ({
        course: m.course,
        assessment: m.assessment,
        score: m.score,
        max_score: m.maxScore,
      }));

      const results = computeCourseResults(markRows, coursesRes.courses);
      return {
        records: attRes.attendance,
        results,
        pendingApps: leaveApps.leaveApplications.filter((l) => l.status === "pending"),
        pendingAppeals: appeals.leaveRequests.filter((l) => l.status === "pending"),
        overallPct: summary.overallOfficialPct,
        conducted,
        attended,
        missed: conducted - attended,
        late,
        excused: attRes.attendance.filter((a) => a.excused).length,
        cgpa: computeCgpa(results),
        lowSubjects: withData
          .filter((r) => !isEligible(r.official_pct))
          .sort((a, b) => (a.official_pct ?? 0) - (b.official_pct ?? 0))
          .map((r) => ({ code: r.course_code, name: r.course_name, pct: r.official_pct ?? 0 })),
        pendingLeave:
          leaveApps.leaveApplications.filter((l) => l.status === "pending").length +
          appeals.leaveRequests.filter((l) => l.status === "pending").length,
        latestLeave: leaveApps.leaveApplications[0] ?? null,
      };
    },
  });
}

export function StudentKpis({ studentId, variant = "student" }: { studentId: string; variant?: "student" | "parent" }) {
  const { data, isLoading, isError } = useStudentOverview(studentId);
  const { profile } = useAuth();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] w-full" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Could not load attendance and results summary.</p>;
  }

  const pct = data.overallPct === null ? null : Math.round(data.overallPct);
  const student: DrillSpec = { kind: "student", studentId, name: profile?.fullName ?? "Attendance", usn: profile?.rollNo };
  const records = (title: string, keep: (r: RecordLite & { excused: boolean }) => boolean) =>
    recordsSpec(title, data.records.filter(keep), { columns: [{ key: "course", label: "Course" }, { key: "entry", label: "Entry" }, { key: "status", label: "Status" }] });
  const pctTone = pct === null ? "neutral" : pct >= 75 ? "present" : pct >= WARNING_THRESHOLD ? "late" : "absent";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label={variant === "parent" ? "Child's attendance" : "Overall attendance"}
        value={pct === null ? "—" : `${pct}%`}
        countTo={pct ?? undefined}
        suffix="%"
        sub={pct === null ? "No closed sessions yet" : pct >= 75 ? "Eligible (75%+)" : "Below the 75% rule"}
        icon={<Percent />}
        tone={pctTone}
        drill={student}
      />
      <KpiCard
        label="Classes attended"
        value={String(data.attended)}
        countTo={data.attended}
        sub={`of ${data.conducted} held`}
        icon={<CalendarCheck2 />}
        tone="present"
        drill={records("Classes attended", (r) => r.status !== "absent")}
      />
      <KpiCard
        label="Classes missed"
        value={String(data.missed)}
        countTo={data.missed}
        sub="Excused sessions not counted"
        icon={<CalendarX2 />}
        tone={data.missed > 0 ? "absent" : "neutral"}
        drill={student}
      />
      <KpiCard
        label="Current CGPA"
        value={data.cgpa === null ? "—" : data.cgpa.toFixed(2)}
        sub={data.cgpa === null ? "No graded courses yet" : "Credit-weighted"}
        icon={<Award />}
        drill={{
          kind: "list",
          title: "Results by course",
          columns: [
            { key: "code", label: "Course" },
            { key: "name", label: "Name" },
            { key: "credits", label: "Credits", numeric: true },
            { key: "score", label: "Score", numeric: true },
            { key: "grade", label: "Grade" },
          ],
          rows: data.results.map((c) => ({
            code: c.code,
            name: c.name,
            credits: String(c.credits),
            score: c.totalPct === null ? "—" : `${Math.round(c.totalPct)}%`,
            grade: c.grade ?? "—",
          })),
          empty: "No marks yet.",
          link: variant === "student" ? { to: "/student/results", label: "Open Results" } : undefined,
        }}
      />
      {variant === "student" ? (
        <>
          <KpiCard label="Late" value={String(data.late)} countTo={data.late} sub="Entries after the late cut-off" icon={<Clock />} tone={data.late > 0 ? "late" : "neutral"} drill={records("Late entries", (r) => r.status === "late" && !r.excused)} />
          <KpiCard label="Excused" value={String(data.excused)} countTo={data.excused} sub="Approved leave or appeals" icon={<ShieldCheck />} drill={records("Excused sessions", (r) => r.excused)} />
        </>
      ) : (
        <KpiCard
          label="Low-attendance subjects"
          value={String(data.lowSubjects.length)}
          countTo={data.lowSubjects.length}
          sub={data.lowSubjects.length ? data.lowSubjects.map((s) => `${s.code} ${Math.round(s.pct)}%`).join(", ") : "All subjects at 75%+"}
          icon={<AlertTriangle />}
          tone={data.lowSubjects.length ? "absent" : "present"}
          drill={student}
        />
      )}
      <KpiCard
        label="Pending leave"
        value={String(data.pendingLeave)}
        countTo={data.pendingLeave}
        sub={
          variant === "parent" && data.latestLeave
            ? `Latest: ${data.latestLeave.leaveType}, ${data.latestLeave.status}`
            : "Leave requests + appeals"
        }
        icon={<FileClock />}
        tone={data.pendingLeave > 0 ? "late" : "neutral"}
        drill={pendingLeaveSpec(data.pendingApps, data.pendingAppeals, variant === "student" ? { to: "/student/leave", label: "Open Leave" } : undefined)}
      />
      {variant === "student" && data.lowSubjects.length > 0 && (
        <KpiCard
          label="Below 75%"
          value={String(data.lowSubjects.length)}
          countTo={data.lowSubjects.length}
          sub={data.lowSubjects.map((s) => s.code).join(", ")}
          icon={<AlertTriangle />}
          tone="absent"
          drill={student}
        />
      )}
    </div>
  );
}
