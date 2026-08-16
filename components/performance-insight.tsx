import { Sparkles, Gauge, TrendingUp, Lightbulb, CircleDashed } from "lucide-react";
import {
  analyzePerformance,
  predictPerformance,
  MARKS_GOOD_THRESHOLD,
  type Band,
  type RiskLevel,
  type Likelihood,
} from "@/lib/performance";
import { ELIGIBILITY_THRESHOLD } from "@/lib/attendance";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/grade-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";



const BAND_VARIANT: Record<Band, "present" | "late"> = {
  good: "present",
  low: "late",
};

const RISK_VARIANT: Record<RiskLevel, "present" | "late" | "absent"> = {
  Low: "present",
  Medium: "late",
  High: "absent",
};

const LIKELIHOOD_VARIANT: Record<Likelihood, "present" | "late" | "absent"> = {
  High: "present",
  Medium: "late",
  Low: "absent",
};


const RISK_TONE: Record<RiskLevel, string> = {
  Low: "text-status-present",
  Medium: "text-status-late",
  High: "text-status-absent",
};

const PLOT = { x0: 14, y0: 6, size: 100 } as const;
const VX = PLOT.x0 + (ELIGIBILITY_THRESHOLD / 100) * PLOT.size;
const HY = PLOT.y0 + PLOT.size - (MARKS_GOOD_THRESHOLD / 100) * PLOT.size;

function QuadrantLocator({
  attendancePct,
  marksPct,
  tone,
}: {
  attendancePct: number;
  marksPct: number;
  tone: string;
}) {
  const px = PLOT.x0 + (attendancePct / 100) * PLOT.size;
  const py = PLOT.y0 + PLOT.size - (marksPct / 100) * PLOT.size;

  return (
    <svg
      viewBox="0 0 122 124"
      className="h-28 w-28 shrink-0"
      role="img"
      aria-hidden="true"
    >
      
      <rect
        x={PLOT.x0}
        y={PLOT.y0}
        width={PLOT.size}
        height={PLOT.size}
        rx="6"
        className="fill-muted/40 stroke-border"
        strokeWidth="1"
      />
      
      <rect
        x={VX}
        y={PLOT.y0}
        width={PLOT.x0 + PLOT.size - VX}
        height={HY - PLOT.y0}
        className="fill-status-present/10"
      />
      
      <line
        x1={VX}
        y1={PLOT.y0}
        x2={VX}
        y2={PLOT.y0 + PLOT.size}
        className="stroke-border"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <line
        x1={PLOT.x0}
        y1={HY}
        x2={PLOT.x0 + PLOT.size}
        y2={HY}
        className="stroke-border"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      
      <g className={cn(tone, "animate-dot-in")}>
        <circle
          cx={px}
          cy={py}
          r="10"
          className="fill-current opacity-10 transition-opacity duration-200 group-hover:opacity-20"
        />
        <circle
          cx={px}
          cy={py}
          r="6"
          className="fill-none stroke-current opacity-40 animate-pulse-ring"
          strokeWidth="1.5"
        />
        <circle
          cx={px}
          cy={py}
          r="3.5"
          className="fill-current stroke-background"
          strokeWidth="1.5"
        />
      </g>
      
      <text
        x={PLOT.x0 + PLOT.size / 2}
        y="120"
        textAnchor="middle"
        className="fill-muted-foreground text-[7px] font-medium uppercase tracking-wider"
      >
        Attendance
      </text>
      <text
        x="6"
        y={PLOT.y0 + PLOT.size / 2}
        textAnchor="middle"
        transform={`rotate(-90 6 ${PLOT.y0 + PLOT.size / 2})`}
        className="fill-muted-foreground text-[7px] font-medium uppercase tracking-wider"
      >
        Marks
      </text>
    </svg>
  );
}


function StatCell({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Gauge;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

export function PerformanceInsight({
  attendancePct,
  marksPct,
  className,
}: {
  attendancePct: number | null;
  marksPct: number | null;
  className?: string;
}) {
  const input = { attendancePct, marksPct };
  const analysis = analyzePerformance(input);
  const prediction = predictPerformance(input);

  return (
    <Card
      className={cn(
        "group overflow-hidden transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-pop",
        className
      )}
    >
      
      <div
        aria-hidden="true"
        className="h-1 w-full bg-gradient-to-r from-[hsl(var(--pes-orange))] via-[hsl(var(--pes-amber-aa))] to-transparent"
      />

      <CardHeader className="relative">
        
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(24rem 8rem at 0% 0%, hsl(var(--primary) / 0.06), transparent 70%)",
          }}
        />
        <div className="relative space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            AI Insight
          </p>
          <CardTitle className="text-lg">Attendance meets performance</CardTitle>
          <CardDescription>
            Where you stand across both — and the one thing to do next.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {analysis === null || prediction === null ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <CircleDashed className="size-4 shrink-0" aria-hidden="true" />
            Not enough data yet. Once you have both attendance and recorded
            marks, personalised guidance appears here.
          </p>
        ) : (
          <div className="space-y-5">
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <QuadrantLocator
                attendancePct={analysis.attendancePct}
                marksPct={analysis.marksPct}
                tone={RISK_TONE[prediction.riskLevel]}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-display text-lg font-semibold leading-snug">
                  {analysis.headline}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={BAND_VARIANT[analysis.attendanceBand]}>
                    <span className="tabular-nums">
                      Attendance {analysis.attendancePct}%
                    </span>
                  </Badge>
                  <Badge variant={BAND_VARIANT[analysis.marksBand]}>
                    <span className="tabular-nums">
                      Marks {analysis.marksPct}%
                    </span>
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{analysis.feedback}</p>
              </div>
            </div>

            
            <div className="grid gap-5 rounded-xl border bg-muted/40 p-4 sm:grid-cols-3">
              <StatCell icon={TrendingUp} label="Expected grade">
                <GradeBadge grade={prediction.expectedGrade} />
              </StatCell>
              <StatCell icon={Gauge} label="Risk level">
                <Badge variant={RISK_VARIANT[prediction.riskLevel]}>
                  {prediction.riskLevel}
                </Badge>
              </StatCell>
              <StatCell icon={Sparkles} label="Improvement odds">
                <Badge variant={LIKELIHOOD_VARIANT[prediction.improvementProbability]}>
                  {prediction.improvementProbability}
                </Badge>
              </StatCell>
            </div>

            
            <p className="flex items-start gap-2.5 rounded-lg bg-primary/5 p-3.5 text-sm">
              <Lightbulb
                className="mt-0.5 size-4 shrink-0 text-[hsl(var(--pes-orange))]"
                aria-hidden="true"
              />
              <span>
                <span className="font-semibold">Do this next: </span>
                {prediction.recommendedAction}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
