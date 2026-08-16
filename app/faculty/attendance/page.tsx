
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpenCheck, AlertTriangle, Layers, Percent, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import {
  fetchCourseAttendance,
  isEligible,
  formatPct,
  attendedCount,
  classesNeededForEligibility,
  ELIGIBILITY_THRESHOLD,
  type AttendanceSummaryRow,
} from "@/lib/attendance";
import { KpiCard } from "@/components/kpi-card";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { ExportMenu } from "@/components/export-menu";
import type { ExportColumn, ExportRow } from "@/lib/export";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CourseOption {
  code: string;
  name: string;
  semester: string;
}

export default function FacultyAttendance() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const course = searchParams.get("course") ?? undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-attendance", profile?.id, course ?? null],
    enabled: !!profile,
    queryFn: async () => {
      const coursesRes = await api.get<{ courses: CourseOption[] }>("/courses");
      const courses = coursesRes.courses ?? [];

      const selected =
        course && courses.some((c) => c.code === course)
          ? course
          : courses[0]?.code ?? null;

      const rows: AttendanceSummaryRow[] = selected
        ? await fetchCourseAttendance(selected)
        : [];

      const ids = rows.map((r) => r.student_id);
      const nameById = new Map<
        string,
        { full_name: string; roll_no: string | null }
      >();
      if (ids.length > 0) {
        const profilesRes = await api.get<{ profiles: { id: string; fullName: string; rollNo: string | null }[] }>("/profiles");
        for (const p of profilesRes.profiles ?? []) {
          if (ids.includes(p.id)) {
            nameById.set(p.id, { full_name: p.fullName, roll_no: p.rollNo });
          }
        }
      }

      return { courses, selected, rows, nameById };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load course attendance.")}
        reset={() => refetch()}
      />
    );

  const { courses, selected, rows, nameById } = data;
  const selectedCourse = courses.find((c) => c.code === selected) ?? null;
  const sorted = [...rows].sort(
    (a, b) => (a.official_pct ?? 200) - (b.official_pct ?? 200)
  );

  const withData = rows.filter((r) => r.conducted > 0);
  const belowCount = withData.filter((r) => !isEligible(r.official_pct)).length;
  const exportColumns: ExportColumn[] = [
    { key: "student", label: "Student" },
    { key: "roll", label: "Roll no" },
    { key: "attended", label: "Attended" },
    { key: "conducted", label: "Conducted" },
    { key: "official", label: "Official %" },
    { key: "weighted", label: "Weighted %" },
    { key: "status", label: "Status" },
  ];
  const exportRows: ExportRow[] = sorted.map((r) => {
    const p = nameById.get(r.student_id);
    return {
      student: p?.full_name ?? "",
      roll: p?.roll_no ?? "",
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
    };
  });
  const avgOfficial =
    withData.length > 0
      ? Math.round(
          (withData.reduce((s, r) => s + (r.official_pct ?? 0), 0) /
            withData.length) *
            100
        ) / 100
      : null;

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Course Attendance" />
      <div>
        <h1 className="text-2xl font-bold">Course Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Per-student attendance and 75% eligibility, by course.
        </p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No courses yet. Create courses and enroll students to see reports
            here.
          </CardContent>
        </Card>
      ) : (
        <>
          
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Course">
            {courses.map((c) => (
              <Link
                key={c.code}
                to={`/faculty/attendance?course=${encodeURIComponent(c.code)}`}
                role="tab"
                aria-selected={c.code === selected}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  c.code === selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {c.name}
              </Link>
            ))}
          </div>

          
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Enrolled"
              value={String(rows.length)}
              countTo={rows.length}
              sub={selectedCourse ? selectedCourse.semester : ""}
              icon={<Users />}
            />
            <KpiCard
              label="Below 75%"
              value={String(belowCount)}
              countTo={belowCount}
              sub="Not eligible"
              icon={<AlertTriangle />}
              tone={belowCount > 0 ? "absent" : "present"}
            />
            <KpiCard
              label="Class average"
              value={avgOfficial !== null ? `${avgOfficial}%` : "—"}
              sub="Official attendance %"
              icon={<Percent />}
              tone={
                avgOfficial === null
                  ? "neutral"
                  : avgOfficial >= 75
                    ? "present"
                    : "late"
              }
            />
          </div>

          
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <BookOpenCheck
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {selectedCourse?.name}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {selected}
                  </span>
                </CardTitle>
                <CardDescription>
                  Students below 75% are highlighted and sorted to the top.
                </CardDescription>
              </div>
              {rows.length > 0 && (
                <div className="flex flex-col items-end gap-2">
                  <ExportMenu
                    filename={`course-attendance-${selected ?? "course"}`}
                    title={`Course Attendance — ${selectedCourse?.name ?? selected}`}
                    subtitle={`${selected}${selectedCourse ? ` · ${selectedCourse.semester}` : ""} · ${rows.length} enrolled`}
                    columns={exportColumns}
                    rows={exportRows}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No students are enrolled in this course yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Roll no</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Attended</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Official %</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Weighted %</th>
                        <th scope="col" className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => {
                        const p = nameById.get(r.student_id);
                        const short =
                          r.conducted > 0 && !isEligible(r.official_pct);
                        return (
                          <tr
                            key={r.student_id}
                            className={cn(
                              "border-b transition-colors last:border-0 hover:bg-muted/50",
                              short && "bg-status-absent/5"
                            )}
                          >
                            <td className="py-2.5 pr-4 font-medium">
                              {p?.full_name ?? "—"}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs">
                              {p?.roll_no ?? "—"}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                              {r.conducted === 0
                                ? "—"
                                : `${attendedCount(r)}/${r.conducted}`}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                              {formatPct(r.official_pct)}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                              {formatPct(r.weighted_pct)}
                            </td>
                            <td className="py-2.5">
                              <EligibilityBadge officialPct={r.official_pct} />
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
