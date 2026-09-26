import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Sigma, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { exportFilename } from "@/lib/export";
import { ELIGIBILITY_THRESHOLD, WARNING_THRESHOLD } from "@/lib/attendance";
import { describeR, linearRegression, pearsonR } from "@/lib/stats";
import { analyzePerformance, MARKS_GOOD_THRESHOLD, predictPerformance } from "@/lib/performance";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { KpiCard } from "@/components/kpi-card";
import { GsapReveal } from "@/components/gsap-reveal";
import { ExportMenu } from "@/components/export-menu";
import { HealthPill, type HealthLevel } from "@/components/health-pill";
import { BAND_COLOR, CorrelationScatter, type CorrelationPoint } from "@/components/charts/correlation-scatter";
import { BandMarksBars, type BandDatum } from "@/components/charts/band-marks-bars";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/grade-badge";
import { clickable, useDrillDown, type DrillSpec } from "@/components/drilldown";

interface CohortRow {
  studentId: string;
  name: string;
  usn: string | null;
  section: string | null;
  attended: number;
  conducted: number;
  attendancePct: number;
  marksPct: number;
  assessments: number;
  band: HealthLevel;
}

const BAND_LABEL: Record<Exclude<HealthLevel, "none">, string> = {
  good: `${ELIGIBILITY_THRESHOLD}%+`,
  warning: `${WARNING_THRESHOLD}–${ELIGIBILITY_THRESHOLD - 1}%`,
  critical: `Below ${WARNING_THRESHOLD}%`,
};

export default function PerformanceAnalytics() {
  const { profile } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { open } = useDrillDown();

  const { data, isPending: isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-performance", profile?.id],
    enabled: !!profile,
    queryFn: () => api.get<{ classesHeld: number; students: CohortRow[] }>("/performance/cohort"),
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return <SectionError error={new Error("Could not load performance analysis.")} reset={() => refetch()} />;

  const rows = data.students
    .map((s) => {
      const input = { attendancePct: s.attendancePct, marksPct: s.marksPct };
      return { ...s, analysis: analyzePerformance(input), prediction: predictPerformance(input) };
    })
    .sort((a, b) => a.attendancePct - b.attendancePct);
  const interventionCount = rows.filter((r) => r.analysis?.atRisk).length;

  const points: CorrelationPoint[] = rows.map((r) => ({
    id: r.studentId,
    name: r.name,
    roll: r.usn,
    x: r.attendancePct,
    y: r.marksPct,
    attended: r.attended,
    conducted: r.conducted,
    assessments: r.assessments,
    band: r.band,
  }));
  const r = pearsonR(points);
  const regression = linearRegression(points);

  const bands: BandDatum[] = (["good", "warning", "critical"] as const).map((band) => {
    const inBand = rows.filter((row) => row.band === band);
    return {
      band,
      label: BAND_LABEL[band],
      count: inBand.length,
      avgMarks: inBand.length ? Math.round(inBand.reduce((n, row) => n + row.marksPct, 0) / inBand.length) : null,
    };
  });

  const cohortSpec = (title: string, list: typeof rows, empty?: string): DrillSpec => ({
    kind: "list",
    title,
    subtitle: "Lowest attendance first. Click a student for courses, marks and leave.",
    columns: [
      { key: "name", label: "Student" },
      { key: "usn", label: "USN" },
      { key: "classes", label: "Classes", numeric: true },
      { key: "att", label: "Attendance", numeric: true },
      { key: "marks", label: "Avg marks", numeric: true },
      { key: "risk", label: "Risk" },
    ],
    rows: list.map((s) => ({
      _studentId: s.studentId,
      _name: s.name,
      _usn: s.usn,
      name: s.name,
      usn: s.usn ?? "—",
      classes: `${s.attended}/${s.conducted}`,
      att: `${s.attendancePct}%`,
      marks: `${s.marksPct}%`,
      risk: s.prediction?.riskLevel ?? "—",
    })),
    empty,
  });
  const openStudent = (id: string) => {
    const s = rows.find((row) => row.studentId === id);
    if (s) open({ kind: "student", studentId: s.studentId, name: s.name, usn: s.usn });
  };

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Performance Analysis" />
      <div>
        <h1 className="text-2xl font-bold">Performance Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Do students who attend more score better? Attendance here is the same figure as on Attendance Health.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Students analysed" value={String(rows.length)} countTo={rows.length} sub="With attendance and at least one mark" icon={<Users />} drill={cohortSpec("Students analysed", rows)} />
        <KpiCard
          label="Requiring intervention"
          value={String(interventionCount)}
          countTo={interventionCount}
          sub={`Below ${ELIGIBILITY_THRESHOLD}% attendance or ${MARKS_GOOD_THRESHOLD}% marks`}
          icon={<AlertTriangle />}
          tone={interventionCount > 0 ? "absent" : "present"}
          drill={cohortSpec("Requiring intervention", rows.filter((row) => row.analysis?.atRisk), "No student needs intervention.")}
        />
        <KpiCard
          label="Correlation (r)"
          value={r === null ? "—" : r.toFixed(2)}
          sub={r === null ? "Needs 3+ students with marks" : describeR(r)}
          icon={<Sigma />}
          tone={r !== null && r >= 0.4 ? "present" : "neutral"}
          drill={cohortSpec("Values behind r", rows)}
        />
        <KpiCard label="Classes held" value={String(data.classesHeld)} countTo={data.classesHeld} sub="Closed sessions in these courses" icon={<CalendarDays />} drill={cohortSpec("Classes attended per student", rows)} />
      </div>

      {points.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No data yet. Record marks on the <span className="font-medium text-foreground">Marks</span> page and close a few
            attendance sessions; each student then appears here.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Attendance vs average marks</CardTitle>
                <CardDescription>
                  Across: attendance %. Up: average marks %. Hover a dot or a table row to see who it is; click to open the student. Dashed lines mark the {ELIGIBILITY_THRESHOLD}%
                  attendance rule and {MARKS_GOOD_THRESHOLD}% marks
                  {r !== null && <> · trend r = {r.toFixed(2)}</>}.
                </CardDescription>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground" aria-label="Legend">
                  {bands.map((b) => (
                    <li key={b.band} className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: BAND_COLOR[b.band] }} aria-hidden="true" />
                      Attendance {b.label} ({b.count})
                    </li>
                  ))}
                </ul>
              </CardHeader>
              <CardContent>
                <CorrelationScatter
                  points={points}
                  regression={regression}
                  eligibilityPct={ELIGIBILITY_THRESHOLD}
                  marksGoodPct={MARKS_GOOD_THRESHOLD}
                  activeId={activeId}
                  onHover={setActiveId}
                  onPointClick={openStudent}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average marks by attendance band</CardTitle>
                <CardDescription>Number of students in brackets. Click a bar for the students.</CardDescription>
              </CardHeader>
              <CardContent>
                <BandMarksBars
                  data={bands}
                  onBandClick={(band) =>
                    band !== "none" &&
                    open(cohortSpec(`Attendance ${BAND_LABEL[band]}`, rows.filter((row) => row.band === band), "No students in this band."))
                  }
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Per-student breakdown</CardTitle>
                <CardDescription>The numbers behind every dot, lowest attendance first.</CardDescription>
              </div>
              <ExportMenu
                filename={exportFilename("performance", [])}
                title="Performance analysis"
                columns={[
                  { key: "name", label: "Student" },
                  { key: "usn", label: "USN" },
                  { key: "attended", label: "Classes attended" },
                  { key: "held", label: "Classes held" },
                  { key: "att", label: "Attendance %" },
                  { key: "marks", label: "Avg marks %" },
                  { key: "n", label: "Assessments" },
                  { key: "band", label: "Attendance band" },
                  { key: "risk", label: "Risk" },
                ]}
                rows={rows.map((row) => ({
                  name: row.name,
                  usn: row.usn ?? "",
                  attended: row.attended,
                  held: row.conducted,
                  att: row.attendancePct,
                  marks: row.marksPct,
                  n: row.assessments,
                  band: row.band,
                  risk: row.prediction?.riskLevel ?? "",
                }))}
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Classes</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Attendance</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Avg marks</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Band</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Expected</th>
                      <th scope="col" className="py-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.studentId}
                        onMouseEnter={() => setActiveId(row.studentId)}
                        onMouseLeave={() => setActiveId(null)}
                        {...clickable(
                          () => openStudent(row.studentId),
                          `border-b transition-colors last:border-0 hover:bg-muted/50 ${activeId === row.studentId ? "bg-muted/60" : ""}`
                        )}
                      >
                        <td className="py-2.5 pr-4">
                          <span className="font-medium">{row.name}</span>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {row.usn ?? "—"}
                            {row.section ? ` · Sec ${row.section}` : ""}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs tabular-nums">
                          {row.attended}/{row.conducted}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs tabular-nums">{row.attendancePct}%</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs tabular-nums">
                          {row.marksPct}%<span className="ml-1 text-muted-foreground">({row.assessments})</span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <HealthPill level={row.band} />
                        </td>
                        <td className="py-2.5 pr-4">
                          <GradeBadge grade={row.prediction?.expectedGrade ?? null} />
                        </td>
                        <td className="py-2.5">
                          {row.prediction ? (
                            <Badge variant={row.prediction.riskLevel === "High" ? "absent" : row.prediction.riskLevel === "Medium" ? "late" : "present"}>
                              {row.prediction.riskLevel}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </GsapReveal>
  );
}
