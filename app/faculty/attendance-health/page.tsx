import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, LoaderCircle, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { exportFilename } from "@/lib/export";
import { ExportMenu } from "@/components/export-menu";
import { HealthPill, type HealthLevel } from "@/components/health-pill";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clickable, useDrillDown } from "@/components/drilldown";

interface Row {
  studentId: string;
  fullName: string;
  rollNo: string | null;
  branch: string | null;
  section: string | null;
  courseCode?: string;
  courseName?: string;
  conducted: number;
  attended: number;
  pct: number;
  status: HealthLevel;
}
interface Health {
  thresholds: { good: number; warning: number };
  totals: { present: number; late: number; partial: number; absent: number; excused: number; conducted: number };
  buckets: { good: number; warning: number; critical: number };
  students: Row[];
  courseRows: Row[];
}

const selectClass =
  "h-10 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function AttendanceHealthPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { open } = useDrillDown();
  const [bucket, setBucket] = useState<"all" | HealthLevel>("all");
  const [view, setView] = useState<"student" | "course">("student");
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");
  const [q, setQ] = useState("");

  const { data, isPending: isLoading, isError, refetch } = useQuery({
    queryKey: ["attendance-health"],
    enabled: !!profile,
    queryFn: () => api.get<Health>("/attendance-health"),
  });

  const check = useMutation({
    mutationFn: () => api.post<{ message: string }>("/notifications/run-attendance-check"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const source = view === "course" ? data?.courseRows ?? [] : data?.students ?? [];
  const courses = useMemo(
    () => [...new Map((data?.courseRows ?? []).map((r) => [r.courseCode!, r.courseName!])).entries()].sort(),
    [data]
  );
  const sections = useMemo(
    () => [...new Set((data?.students ?? []).map((r) => r.section).filter(Boolean) as string[])].sort(),
    [data]
  );

  const rows = source.filter((r) => {
    if (bucket !== "all" && r.status !== bucket) return false;
    if (view === "course" && course && r.courseCode !== course) return false;
    if (section && r.section !== section) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!r.fullName.toLowerCase().includes(t) && !(r.rollNo ?? "").toLowerCase().includes(t)) return false;
    }
    return true;
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data) return <SectionError error={new Error("Could not load attendance health.")} reset={() => refetch()} />;

  const t = data.thresholds;
  const attendedAll = data.totals.present + data.totals.late + data.totals.partial;
  const overall = data.totals.conducted === 0 ? null : Math.round((100 * attendedAll) / data.totals.conducted);
  const hasFilters = bucket !== "all" || course || section || q;

  const BUCKETS: Array<{ id: HealthLevel; label: string; count: number }> = [
    { id: "good", label: `${t.good}% and above`, count: data.buckets.good },
    { id: "warning", label: `${t.warning}–${t.good - 1}%`, count: data.buckets.warning },
    { id: "critical", label: `Below ${t.warning}%`, count: data.buckets.critical },
  ];

  return (
    <div className="space-y-6">
      <PageTitle title="Attendance health" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendance health</h1>
          <p className="text-sm text-muted-foreground">
            Everyone&apos;s attendance across closed sessions. Excused sessions don&apos;t count against a student.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>
          {check.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <BellRing className="size-4" aria-hidden="true" />}
          Send low-attendance alerts
        </Button>
      </div>
      {check.data && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {check.data.message} Alerts appear on the student and parent dashboards (demo — no SMS or email is sent).
        </p>
      )}
      {check.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{(check.error as Error).message}</p>
      )}

      <Card>
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-[1fr_1.4fr]">
          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <Figure label="Overall" value={overall === null ? "—" : `${overall}%`} strong />
            <Figure label="Present" value={data.totals.present} />
            <Figure label="Late" value={data.totals.late} />
            <Figure label="Partial" value={data.totals.partial} />
            <Figure label="Absent" value={data.totals.absent} />
            <Figure label="Excused" value={data.totals.excused} />
          </dl>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Students by overall attendance</p>
            <div className="divide-y rounded-md border">
              {BUCKETS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBucket(bucket === b.id ? "all" : b.id)}
                  aria-pressed={bucket === b.id}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 ${
                    bucket === b.id ? "bg-muted" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <HealthPill level={b.id} />
                    <span className="text-muted-foreground">{b.label}</span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {b.count} student{b.count === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Click a band to filter the list below.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{bucket === "all" ? "All students" : `${bucket[0].toUpperCase()}${bucket.slice(1)} students`}</CardTitle>
              <CardDescription>
                {rows.length} {view === "course" ? "student-course pairs" : "students"} · lowest attendance first
              </CardDescription>
            </div>
            <ExportMenu
              filename={exportFilename("attendance_health", [bucket !== "all" ? bucket : "", course, section])}
              title="Attendance health"
              subtitle={[bucket !== "all" && `Band: ${bucket}`, course && `Course: ${course}`, section && `Section: ${section}`, q && `Search: ${q}`]
                .filter(Boolean)
                .join(" · ")}
              columns={[
                { key: "name", label: "Student" },
                { key: "usn", label: "USN" },
                ...(view === "course" ? [{ key: "course", label: "Course" }] : []),
                { key: "section", label: "Section" },
                { key: "pct", label: "Attendance %" },
                { key: "attended", label: "Classes attended" },
                { key: "total", label: "Total classes" },
                { key: "status", label: "Status" },
              ]}
              rows={rows.map((r) => ({
                name: r.fullName,
                usn: r.rollNo ?? "",
                course: r.courseCode ?? "",
                section: r.section ?? "",
                pct: r.status === "none" ? "" : r.pct,
                attended: r.attended,
                total: r.conducted,
                status: r.status,
              }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-0.5 text-sm" role="tablist" aria-label="Group by">
              {(["student", "course"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`rounded px-2.5 py-1 ${view === v ? "bg-muted font-medium" : "text-muted-foreground"}`}
                >
                  {v === "student" ? "Overall" : "By course"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search by name or USN"
                placeholder="Name or USN"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-10 w-48 pl-8"
              />
            </div>
            {view === "course" && (
              <select aria-label="Course" value={course} onChange={(e) => setCourse(e.target.value)} className={selectClass}>
                <option value="">All courses</option>
                {courses.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
            )}
            <select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className={selectClass}>
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBucket("all");
                  setCourse("");
                  setSection("");
                  setQ("");
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {source.length === 0 ? "No attendance recorded yet — close a session to see data here." : "No students match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                    <th scope="col" className="py-2 pr-4 font-medium">USN</th>
                    {view === "course" && <th scope="col" className="py-2 pr-4 font-medium">Course</th>}
                    <th scope="col" className="py-2 pr-4 font-medium">Section</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Attendance</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Attended</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Total</th>
                    <th scope="col" className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.studentId}-${r.courseCode ?? ""}`}
                      {...clickable(
                        () =>
                          open(
                            r.courseCode
                              ? { kind: "course", studentId: r.studentId, courseCode: r.courseCode, courseName: `${r.courseName ?? r.courseCode} · ${r.fullName}` }
                              : { kind: "student", studentId: r.studentId, name: r.fullName, usn: r.rollNo }
                          ),
                        "border-b last:border-0 hover:bg-muted/40"
                      )}
                    >
                      <td className="py-2.5 pr-4 font-medium">{r.fullName}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{r.rollNo ?? "—"}</td>
                      {view === "course" && (
                        <td className="py-2.5 pr-4" title={r.courseName}>
                          {r.courseCode}
                        </td>
                      )}
                      <td className="py-2.5 pr-4">{r.section ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">
                        {r.status === "none" ? "—" : `${r.pct}%`}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{r.attended}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{r.conducted}</td>
                      <td className="py-2.5">
                        <HealthPill level={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-2xl font-bold" : "text-lg font-semibold"}`}>{value}</dd>
    </div>
  );
}
