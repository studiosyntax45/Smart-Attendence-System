import { CircleDashed, Lightbulb, Sparkles } from "lucide-react";
import { PerformanceInsight } from "@/components/performance-insight";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ATTENDANCE_TARGET,
  MARKS_TARGET,
  STATUS_LABEL,
  STATUS_VARIANT,
  sourceNote,
  type StudentInsight,
  type SubjectInsight,
} from "@/lib/insights";
import { cn } from "@/lib/utils";

function Meter({ label, pct, target, detail }: { label: string; pct: number | null; target: number; detail?: string }) {
  const low = pct !== null && pct < target;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("font-mono tabular-nums", low ? "text-status-late" : "text-foreground")}>
          {pct === null ? "—" : `${pct}%`}
          {detail && <span className="ml-1 text-muted-foreground">{detail}</span>}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full", low ? "bg-status-late" : "bg-status-present")}
          style={{ width: `${pct ?? 0}%` }}
        />
        <div className="absolute -top-0.5 h-2.5 w-px bg-foreground/50" style={{ left: `${target}%` }} title={`Target ${target}%`} />
      </div>
    </div>
  );
}

export function SubjectInsightCard({ subject }: { subject: SubjectInsight }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base leading-snug">{subject.courseName}</CardTitle>
            <CardDescription className="font-mono text-xs">{subject.course}</CardDescription>
          </div>
          <Badge variant={STATUS_VARIANT[subject.status]} className="shrink-0">
            {STATUS_LABEL[subject.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="space-y-3">
          <Meter
            label="Attendance"
            pct={subject.attendancePct}
            target={ATTENDANCE_TARGET}
            detail={subject.conducted > 0 ? `(${subject.attended}/${subject.conducted})` : undefined}
          />
          <Meter label="Marks" pct={subject.marksPct} target={MARKS_TARGET} />
        </div>
        {subject.assessments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {subject.assessments.map((a) => (
              <span
                key={a.name}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs tabular-nums",
                  a.pct < MARKS_TARGET ? "border-status-late/40 text-status-late" : "text-muted-foreground"
                )}
              >
                {a.name} {a.pct}%
              </span>
            ))}
          </div>
        )}
        <p className="text-sm">{subject.insight}</p>
        <p className="mt-auto flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-[hsl(var(--pes-orange))]" aria-hidden="true" />
          <span>{subject.action}</span>
        </p>
      </CardContent>
    </Card>
  );
}

/** The whole insight for one student: overall card, then one card per subject. */
export function StudentInsightView({ insight, isLoading = false }: { insight: StudentInsight | undefined; isLoading?: boolean }) {
  if (isLoading || !insight) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <CircleDashed className="size-4 animate-spin" aria-hidden="true" />
        Generating insights from the latest attendance and marks…
      </p>
    );
  }
  const behind = insight.subjects.filter((s) => s.status !== "on_track" && s.status !== "no_data").length;
  return (
    <div className="space-y-6">
      <PerformanceInsight
        attendancePct={insight.attendancePct}
        marksPct={insight.marksPct}
        aiFeedback={{ source: insight.source, ...insight.overall }}
      />
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Subject by subject
          </h2>
          <p className="text-sm text-muted-foreground">
            {insight.subjects.length === 0
              ? "No subjects yet."
              : behind === 0
                ? `All ${insight.subjects.length} subjects on track`
                : `${behind} of ${insight.subjects.length} subjects need attention`}
          </p>
        </div>
        {insight.subjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Subject insights appear once you are enrolled in courses and classes or marks are recorded.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {insight.subjects.map((s) => (
              <SubjectInsightCard key={s.course} subject={s} />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{sourceNote(insight.source)}</p>
      </section>
    </div>
  );
}
