import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CircleDashed, Eye, GraduationCap, Lightbulb, Sparkles, TriangleAlert, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  ATTENDANCE_TARGET,
  MARKS_TARGET,
  getClassInsight,
  getStudentInsight,
  listInsightCourses,
  sourceNote,
  type ClassInsightResponse,
} from "@/lib/insights";
import { StudentInsightView } from "@/components/insights/student-insight-view";
import { KpiCard } from "@/components/kpi-card";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-96";

const pctText = (v: number | null) => (v === null ? "—" : `${v}%`);

function StudentInsightDialog({ student, onClose }: { student: { id: string; name: string } | null; onClose: () => void }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["student-insight", student?.id],
    enabled: !!student,
    queryFn: () => getStudentInsight(student!.id),
  });
  return (
    <Dialog open={student !== null} onClose={onClose} title={student ? `AI insights: ${student.name}` : ""} subtitle={data?.student.usn ?? undefined}>
      {isError ? (
        <div className="space-y-3 py-6 text-sm">
          <p>Could not load this student&apos;s insights.</p>
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : (
        <StudentInsightView insight={data?.insight} isLoading={isPending} />
      )}
    </Dialog>
  );
}

function ClassInsightPanel({ data, onOpenStudent }: { data: ClassInsightResponse; onOpenStudent: (s: { id: string; name: string }) => void }) {
  const { metrics: m, rows, insight } = data;
  const behind = rows.filter(
    (r) => (r.attendancePct !== null && r.attendancePct < ATTENDANCE_TARGET) || (r.marksPct !== null && r.marksPct < MARKS_TARGET)
  );
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Students" value={String(m.students)} icon={<Users className="size-4" />} />
        <KpiCard label="Classes held" value={String(m.sessionsHeld)} icon={<CalendarCheck className="size-4" />} />
        <KpiCard
          label="Avg attendance"
          value={pctText(m.attendancePct)}
          sub={`${m.belowAttendance} below ${ATTENDANCE_TARGET}%`}
          icon={<CalendarCheck className="size-4" />}
          tone={m.attendancePct === null ? "neutral" : m.attendancePct < ATTENDANCE_TARGET ? "late" : "present"}
        />
        <KpiCard
          label="Avg marks"
          value={pctText(m.marksPct)}
          sub={`${m.belowMarks} below ${MARKS_TARGET}%`}
          icon={<GraduationCap className="size-4" />}
          tone={m.marksPct === null ? "neutral" : m.marksPct < MARKS_TARGET ? "late" : "present"}
        />
      </section>

      <Card>
        <CardHeader>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Class insight
          </p>
          <CardTitle className="text-lg">Where {m.courseName} is behind</CardTitle>
          <CardDescription>{insight.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-status-late">Focus areas</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
              {insight.focusAreas.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Suggested next steps</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {insight.actions.map((a) => (
                <li key={a} className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-[hsl(var(--pes-orange))]" aria-hidden="true" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">{sourceNote(insight.source)}</p>
        </CardContent>
      </Card>

      {m.assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assessments, weakest first</CardTitle>
            <CardDescription>Class average per assessment. The line marks the {MARKS_TARGET}% target.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {m.assessments.map((a) => (
              <div key={a.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{a.name}</span>
                  <span className={cn("font-mono tabular-nums", a.pct < MARKS_TARGET && "text-status-late")}>
                    {a.pct}% <span className="text-xs text-muted-foreground">({a.count} students)</span>
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-muted" aria-hidden="true">
                  <div className={cn("h-full rounded-full", a.pct < MARKS_TARGET ? "bg-status-late" : "bg-status-present")} style={{ width: `${a.pct}%` }} />
                  <div className="absolute -top-0.5 h-3 w-px bg-foreground/50" style={{ left: `${MARKS_TARGET}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students</CardTitle>
          <CardDescription>
            {behind.length > 0
              ? `${behind.length} of ${rows.length} are below ${ATTENDANCE_TARGET}% attendance or ${MARKS_TARGET}% marks; they are listed first.`
              : "Everyone is on target."}{" "}
            Open a student to see their insight for each subject.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">USN</th>
                <th className="px-4 py-2 text-right font-medium">Attendance</th>
                <th className="px-4 py-2 text-right font-medium">Marks</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const lowAtt = r.attendancePct !== null && r.attendancePct < ATTENDANCE_TARGET;
                const lowMarks = r.marksPct !== null && r.marksPct < MARKS_TARGET;
                return (
                  <tr key={r.studentId} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {(lowAtt || lowMarks) && <TriangleAlert className="size-3.5 text-status-late" aria-label="Below target" />}
                        {r.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.usn ?? "—"}</td>
                    <td className={cn("px-4 py-2 text-right font-mono tabular-nums", lowAtt && "text-status-late")}>{pctText(r.attendancePct)}</td>
                    <td className={cn("px-4 py-2 text-right font-mono tabular-nums", lowMarks && "text-status-late")}>{pctText(r.marksPct)}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => onOpenStudent({ id: r.studentId, name: r.name })} aria-label={`View insights for ${r.name}`}>
                        <Eye className="size-3.5" aria-hidden="true" />
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No students are enrolled in this course.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FacultyInsightsPage() {
  const { profile } = useAuth();
  const [course, setCourse] = useState("");
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);

  const courses = useQuery({ queryKey: ["insight-courses", profile?.id], enabled: !!profile, queryFn: listInsightCourses });
  const cls = useQuery({ queryKey: ["class-insight", course], enabled: course !== "", queryFn: () => getClassInsight(course) });

  useEffect(() => {
    if (!course && courses.data?.length) setCourse(courses.data[0]!.code);
  }, [course, courses.data]);

  if (!profile || courses.isPending) return <PageSkeleton />;
  if (courses.isError) return <SectionError error={new Error("Could not load your courses.")} reset={() => courses.refetch()} />;

  return (
    <div className="space-y-6">
      <PageTitle title="AI Insights" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Insights</h1>
          <p className="text-sm text-muted-foreground">
            Where each class is behind, and each student&apos;s insight for every subject.
          </p>
        </div>
        {courses.data.length > 0 && (
          <select aria-label="Course" value={course} onChange={(e) => setCourse(e.target.value)} className={selectClass}>
            {courses.data.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name} ({c.students} students)
              </option>
            ))}
          </select>
        )}
      </div>

      {courses.data.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No courses yet. Courses appear here once you are timetabled on them or open a session.
          </CardContent>
        </Card>
      ) : cls.isError ? (
        <SectionError error={new Error("Could not load the class insight.")} reset={() => cls.refetch()} />
      ) : cls.isPending ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <CircleDashed className="size-4 animate-spin" aria-hidden="true" />
          Analysing the class…
        </p>
      ) : (
        <ClassInsightPanel data={cls.data} onOpenStudent={setStudent} />
      )}

      <StudentInsightDialog student={student} onClose={() => setStudent(null)} />
    </div>
  );
}
