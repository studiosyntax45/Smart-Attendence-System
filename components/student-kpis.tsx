import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Award, CalendarCheck2, CalendarX2, Clock, FileClock, Percent, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { fetchStudentAttendance, isEligible, summarizeStudent, WARNING_THRESHOLD } from "@/lib/attendance";
import { computeCgpa, computeCourseResults, type CourseMeta, type MarkRow } from "@/lib/results";
import { KpiCard } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";

/** Uses the server summary, so sessions a student never joined count as missed. */
export function useStudentOverview(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-overview", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const [summaryRows, attRes, marksRes, coursesRes, leaveApps, appeals] = await Promise.all([
        fetchStudentAttendance(studentId!),
        api.get<{ attendance: Array<{ excused: boolean }> }>(`/attendance?studentId=${studentId}`),
        api.get<{ marks: Array<{ course: string; assessment: string; score: number; maxScore: number }> }>(`/marks?studentId=${studentId}`),
        api.get<{ courses: CourseMeta[] }>("/courses"),
        api.get<{ leaveApplications: Array<{ status: string; leaveType: string; fromDate: string; toDate: string }> }>("/leave-applications"),
        api.get<{ leaveRequests: Array<{ status: string }> }>("/leave-requests?mine=true"),
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

      return {
        overallPct: summary.overallOfficialPct,
        conducted,
        attended,
        missed: conducted - attended,
        late,
        excused: attRes.attendance.filter((a) => a.excused).length,
        cgpa: computeCgpa(computeCourseResults(markRows, coursesRes.courses)),
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
      />
      <KpiCard
        label="Classes attended"
        value={String(data.attended)}
        countTo={data.attended}
        sub={`of ${data.conducted} held`}
        icon={<CalendarCheck2 />}
        tone="present"
      />
      <KpiCard
        label="Classes missed"
        value={String(data.missed)}
        countTo={data.missed}
        sub="Excused sessions not counted"
        icon={<CalendarX2 />}
        tone={data.missed > 0 ? "absent" : "neutral"}
      />
      <KpiCard
        label="Current CGPA"
        value={data.cgpa === null ? "—" : data.cgpa.toFixed(2)}
        sub={data.cgpa === null ? "No graded courses yet" : "Credit-weighted"}
        icon={<Award />}
        href={variant === "student" ? "/student/results" : undefined}
      />
      {variant === "student" ? (
        <>
          <KpiCard label="Late" value={String(data.late)} countTo={data.late} sub="Entries after the late cut-off" icon={<Clock />} tone={data.late > 0 ? "late" : "neutral"} />
          <KpiCard label="Excused" value={String(data.excused)} countTo={data.excused} sub="Approved leave or appeals" icon={<ShieldCheck />} />
        </>
      ) : (
        <KpiCard
          label="Low-attendance subjects"
          value={String(data.lowSubjects.length)}
          countTo={data.lowSubjects.length}
          sub={data.lowSubjects.length ? data.lowSubjects.map((s) => `${s.code} ${Math.round(s.pct)}%`).join(", ") : "All subjects at 75%+"}
          icon={<AlertTriangle />}
          tone={data.lowSubjects.length ? "absent" : "present"}
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
        href={variant === "student" ? "/student/leave" : undefined}
      />
      {variant === "student" && data.lowSubjects.length > 0 && (
        <KpiCard
          label="Below 75%"
          value={String(data.lowSubjects.length)}
          countTo={data.lowSubjects.length}
          sub={data.lowSubjects.map((s) => s.code).join(", ")}
          icon={<AlertTriangle />}
          tone="absent"
          href="/student/attendance"
        />
      )}
    </div>
  );
}
