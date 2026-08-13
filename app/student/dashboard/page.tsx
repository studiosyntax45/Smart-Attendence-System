
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ListChecks,
  ScanFace,
  Timer,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { KpiCard } from "@/components/kpi-card";
import { StatusPill } from "@/components/status-pill";
import { GsapReveal } from "@/components/gsap-reveal";
import { AttendanceRing } from "@/components/charts/attendance-ring";
import { DurationBars, type DurationDatum } from "@/components/charts/duration-bars";
import { PerformanceInsight } from "@/components/performance-insight";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startOfToday, type AttendanceStatus } from "@/lib/utils";

interface AttendanceRow {
  id: string;
  entry_time: string;
  exit_time: string | null;
  duration_min: number | null;
  status: AttendanceStatus;
  excused?: boolean;
  sessions: { course: string } | null;
}

export default function StudentDashboard() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-dashboard", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const since = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const [attRes, sessionsRes, marksRes] = await Promise.all([
        api.get<{ attendance: Array<{ id: string; entryTime: string; exitTime: string | null; durationMin: number | null; status: AttendanceStatus; excused?: boolean; session?: { course: string } }> }>(`/attendance?studentId=${profile!.id}`),
        api.get<{ sessions: Array<{ id: string; openedAt: string }> }>("/sessions"),
        api.get<{ marks: Array<{ id: string; course: string; assessment: string; score: number; maxScore: number }> }>(`/marks?studentId=${profile!.id}`),
      ]);

      const rows: AttendanceRow[] = (attRes.attendance ?? [])
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

      const sessionsHeld = (sessionsRes.sessions ?? []).filter(
        (s) => s.openedAt >= since
      ).length;

      const myMarks = (marksRes.marks ?? []).map((m) => ({
        id: m.id,
        course: m.course,
        assessment: m.assessment,
        score: m.score,
        max_score: m.maxScore,
      }));

      return { rows, sessionsHeld, myMarks };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load your dashboard.")}
        reset={() => refetch()}
      />
    );

  const records = data.rows;
  const counted = records.filter((r) => !r.excused);
  const effectiveHeld =
    records.length > 0 ? counted.length : data.sessionsHeld;
  const attended = counted.filter((r) => r.status !== "absent").length;
  const pct =
    effectiveHeld > 0 ? Math.round((attended / effectiveHeld) * 100) : null;

  const durations = records
    .map((r) => r.duration_min)
    .filter((d): d is number => d !== null);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  const todayStart = startOfToday();
  const todayRecord = records.find((r) => new Date(r.entry_time) >= todayStart);

  const marks = data.myMarks;
  const avgMarksPct =
    marks.length > 0
      ? Math.round(
          marks.reduce(
            (s, m) => s + (Number(m.score) / Number(m.max_score)) * 100,
            0
          ) / marks.length
        )
      : null;

  const chartData: DurationDatum[] = records
    .filter((r) => r.duration_min !== null)
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      label: new Date(r.entry_time).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      course: r.sessions?.course ?? "Class",
      minutes: r.duration_min as number,
    }));

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Student Dashboard" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Hello, {profile.fullName.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {profile.rollNo && (
              <span className="font-mono">{profile.rollNo} Ã‚Â· </span>
            )}
            Last 30 days at a glance
          </p>
        </div>
        <Link to="/student/mark-attendance">
          <Button variant="accent">
            <ScanFace className="size-4" aria-hidden="true" />
            Mark Attendance
          </Button>
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-pop lg:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle>Attendance rate</CardTitle>
            <CardDescription>Rolling 30-day window</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center pb-6 pt-4">
            <AttendanceRing pct={pct} attended={attended} held={effectiveHeld} />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3">
          <KpiCard
            label="Today"
            value={todayRecord ? "Marked" : "Not marked"}
            sub={
              todayRecord
                ? `Entry ${new Date(todayRecord.entry_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "No entry yet"
            }
            icon={<CalendarCheck2 />}
            tone={todayRecord ? "present" : "late"}
          />
          <KpiCard
            label="Sessions held"
            value={String(effectiveHeld)}
            countTo={effectiveHeld}
            sub="In the last 30 days (excused excluded)"
            icon={<CalendarDays />}
          />
          <KpiCard
            label="Avg duration"
            value={avgDuration !== null ? `${avgDuration} min` : "Ã¢â‚¬â€"}
            countTo={avgDuration ?? undefined}
            suffix=" min"
            sub="Per attended class"
            icon={<Timer />}
          />
          <KpiCard
            label="Classes attended"
            value={String(attended)}
            countTo={attended}
            sub={
              effectiveHeld > 0
                ? `Of ${effectiveHeld} held`
                : "No sessions yet"
            }
            icon={<ListChecks />}
            tone={pct === null ? "neutral" : pct >= 75 ? "present" : "absent"}
          />
        </div>
      </section>

      <PerformanceInsight attendancePct={pct} marksPct={avgMarksPct} />

      {chartData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Time in class</CardTitle>
            <CardDescription>
              Minutes per attended session Ã¢â‚¬â€ last {chartData.length} sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DurationBars data={chartData} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              My marks
            </CardTitle>
            <CardDescription>
              Recorded by your faculty Ã¢â‚¬â€ read-only.
            </CardDescription>
          </div>
          {avgMarksPct !== null && (
            <p className="text-right">
              <span className="font-display text-2xl font-semibold">{avgMarksPct}%</span>
              <span className="block text-xs text-muted-foreground">average</span>
            </p>
          )}
        </CardHeader>
        <CardContent>
          {marks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No marks recorded yet Ã¢â‚¬â€ scores appear here once your faculty
              uploads them.
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
                      <tr key={m.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
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
            Entry, exit and duration per class Ã¢â‚¬â€ newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No attendance records yet. Mark your first attendance to see it
              here.
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
                        {r.sessions?.course ?? "Ã¢â‚¬â€"}
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
                          : "Ã¢â‚¬â€"}
                      </td>
                      <td className="py-2.5 pr-4">
                        {r.duration_min !== null ? `${r.duration_min} min` : "Ã¢â‚¬â€"}
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
