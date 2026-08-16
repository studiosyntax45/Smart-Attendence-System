
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, AlertTriangle, Layers, Percent, Users, Sigma } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { KpiCard } from "@/components/kpi-card";
import { GsapReveal } from "@/components/gsap-reveal";
import {
  CorrelationScatter,
  type CorrelationPoint,
} from "@/components/charts/correlation-scatter";
import { describeR, linearRegression, pearsonR } from "@/lib/stats";
import { analyzePerformance, predictPerformance } from "@/lib/performance";
import { PerformanceInsight } from "@/components/performance-insight";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttendanceStatus } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/grade-badge";

export default function PerformanceAnalytics() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-performance", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [
        sessionsRes,
        attendanceRes,
        marksRes,
        studentsRes,
      ] = await Promise.all([
        api.get<{ sessions: Array<{ id: string }> }>("/sessions"),
        api.get<{ attendance: Array<{ studentId: string; status: AttendanceStatus }> }>("/attendance"),
        api.get<{ marks: Array<{ studentId: string; score: number; maxScore: number }> }>("/marks"),
        api.get<{ profiles: Array<{ id: string; fullName: string; rollNo: string | null }> }>("/profiles?role=student"),
      ]);

      const attendanceRows = (attendanceRes.attendance ?? [])
        .filter((a) => a.status !== "absent")
        .map((a) => ({ student_id: a.studentId, status: a.status }));

      const markRows = (marksRes.marks ?? []).map((m) => ({
        student_id: m.studentId,
        score: m.score,
        max_score: m.maxScore,
      }));

      const students = (studentsRes.profiles ?? []).map((s) => ({
        id: s.id,
        full_name: s.fullName,
        roll_no: s.rollNo,
      }));

      return {
        totalSessions: (sessionsRes.sessions ?? []).length,
        attendanceRows,
        markRows,
        students,
      };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load performance analysis.")}
        reset={() => refetch()}
      />
    );

  const { totalSessions, attendanceRows, markRows, students } = data;

  const attendedBy = new Map<string, number>();
  for (const row of attendanceRows) {
    attendedBy.set(row.student_id, (attendedBy.get(row.student_id) ?? 0) + 1);
  }

  const marksBy = new Map<string, { totalPct: number; n: number }>();
  for (const row of markRows) {
    const pct = (Number(row.score) / Number(row.max_score)) * 100;
    const agg = marksBy.get(row.student_id) ?? { totalPct: 0, n: 0 };
    agg.totalPct += pct;
    agg.n += 1;
    marksBy.set(row.student_id, agg);
  }

  const held = totalSessions;
  const rows = students
    .filter((s) => marksBy.has(s.id))
    .map((s) => {
      const marks = marksBy.get(s.id)!;
      const attended = attendedBy.get(s.id) ?? 0;
      return {
        name: s.full_name,
        roll: s.roll_no,
        attendancePct: held > 0 ? Math.round((attended / held) * 100) : 0,
        marksPct: Math.round(marks.totalPct / marks.n),
        assessments: marks.n,
      };
    })
    .sort((a, b) => b.attendancePct - a.attendancePct);
  const analyzedRows = rows.map((r) => {
    const input = { attendancePct: r.attendancePct, marksPct: r.marksPct };
    return {
      ...r,
      analysis: analyzePerformance(input),
      prediction: predictPerformance(input),
    };
  });
  const interventionCount = analyzedRows.filter(
    (r) => r.analysis?.atRisk
  ).length;

  const points: CorrelationPoint[] = rows.map((r) => ({
    name: r.name,
    roll: r.roll,
    x: r.attendancePct,
    y: r.marksPct,
  }));

  const r = pearsonR(points);
  const regression = linearRegression(points);

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Performance Analysis" />
      <div>
        <h1 className="text-2xl font-bold">Performance Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Does showing up correlate with scoring well? One dot per student.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Students analyzed"
          value={String(rows.length)}
          countTo={rows.length}
          sub="With at least one mark"
          icon={<Users />}
        />
        <KpiCard
          label="Requiring intervention"
          value={String(interventionCount)}
          countTo={interventionCount}
          sub="Low attendance or marks"
          icon={<AlertTriangle />}
          tone={interventionCount > 0 ? "absent" : "present"}
        />
        <KpiCard
          label="Correlation (r)"
          value={r === null ? "—" : r.toFixed(2)}
          sub={
            r === null
              ? "Needs 3+ students with marks"
              : describeR(r)
          }
          icon={<Sigma />}
          tone={r !== null && r >= 0.4 ? "present" : "neutral"}
        />
        <KpiCard
          label="Sessions held"
          value={String(held)}
          countTo={held}
          sub="Attendance denominator"
          icon={<TrendingUp />}
        />
      </div>

      {points.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No data to correlate yet. Record marks on the{" "}
            <span className="font-medium text-foreground">Marks</span> page and
            run a few attendance sessions — dots appear here per student.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Attendance vs average marks</CardTitle>
              <CardDescription>
                Dashed line shows the least-squares trend
                {r !== null && <> · r = {r.toFixed(2)} ({describeR(r)})</>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CorrelationScatter points={points} regression={regression} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per-student breakdown</CardTitle>
              <CardDescription>
                The table behind the chart — sorted by attendance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Roll no</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Attendance</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Avg marks</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Expected</th>
                      <th scope="col" className="py-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzedRows.map((row) => (
                      <tr
                        key={row.roll ?? row.name}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-2.5 pr-4 font-medium">{row.name}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {row.roll ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {row.attendancePct}%
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {row.marksPct}%
                        </td>
                        <td className="py-2.5 pr-4">
                          <GradeBadge grade={row.prediction?.expectedGrade ?? null} />
                        </td>
                        <td className="py-2.5">
                          {row.prediction ? (
                            <Badge
                              variant={
                                row.prediction.riskLevel === "High"
                                  ? "absent"
                                  : row.prediction.riskLevel === "Medium"
                                    ? "late"
                                    : "present"
                              }
                            >
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
