import {
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HealthLevel } from "@/components/health-pill";

export interface CorrelationPoint {
  id: string;
  name: string;
  roll: string | null;
  x: number;
  y: number;
  attended: number;
  conducted: number;
  assessments: number;
  band: HealthLevel;
}

export const BAND_COLOR: Record<HealthLevel, string> = {
  good: "hsl(var(--status-present))",
  warning: "hsl(var(--status-late))",
  critical: "hsl(var(--status-absent))",
  none: "hsl(var(--muted-foreground))",
};

const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

function Dot(props: { cx?: number; cy?: number; payload?: CorrelationPoint; activeId?: string | null }) {
  const { cx, cy, payload, activeId } = props;
  if (cx === undefined || cy === undefined || !payload) return <g />;
  const active = payload.id === activeId;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 8 : 5}
      fill={BAND_COLOR[payload.band]}
      stroke={active ? "hsl(var(--foreground))" : "hsl(var(--card))"}
      strokeWidth={2}
    />
  );
}

export function CorrelationScatter({
  points,
  regression,
  eligibilityPct,
  marksGoodPct,
  activeId = null,
  onHover,
  onPointClick,
}: {
  points: CorrelationPoint[];
  regression: { slope: number; intercept: number } | null;
  eligibilityPct: number;
  marksGoodPct: number;
  activeId?: string | null;
  onHover?: (id: string | null) => void;
  onPointClick?: (id: string) => void;
}) {
  // Draw the trend only across the attendance range we have data for; beyond it is guesswork.
  const xs = points.map((p) => p.x);
  const trend =
    regression === null || xs.length === 0
      ? []
      : [Math.min(...xs), Math.max(...xs)].map((x) => ({
          x,
          y: Math.max(0, Math.min(100, regression.intercept + regression.slope * x)),
        }));

  return (
    <div
      className="h-80 w-full"
      role="img"
      aria-label={`Scatter plot of attendance against average marks for ${points.length} students. The table below lists the same values.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 16, right: 16, left: -8, bottom: 16 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            ticks={[0, 25, 50, 65, 75, 100]}
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={(v: number) => `${v}%`}
            label={{ value: "Attendance %", position: "insideBottom", offset: -10, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 100]}
            ticks={[0, 25, 50, 70, 100]}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={axisTick}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ReferenceLine
            x={eligibilityPct}
            stroke="hsl(var(--foreground))"
            strokeOpacity={0.45}
            strokeDasharray="4 4"
            label={{ value: `${eligibilityPct}% attendance rule`, position: "insideTopLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <ReferenceLine
            y={marksGoodPct}
            stroke="hsl(var(--foreground))"
            strokeOpacity={0.45}
            strokeDasharray="4 4"
            label={{ value: `${marksGoodPct}% marks`, position: "insideBottomLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as CorrelationPoint;
              if (d.name === undefined) return null;
              return (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-pop">
                  <p className="font-medium text-card-foreground">
                    {d.name}
                    {d.roll && <span className="ml-1 font-mono text-muted-foreground">{d.roll}</span>}
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    Attendance <span className="font-mono text-card-foreground">{d.x}%</span> ({d.attended} of {d.conducted} classes)
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    Avg marks <span className="font-mono text-card-foreground">{d.y}%</span> over {d.assessments} assessment
                    {d.assessments === 1 ? "" : "s"}
                  </p>
                </div>
              );
            }}
          />
          {trend.length === 2 && (
            <Scatter
              data={trend}
              line={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5, strokeDasharray: "6 4" }}
              shape={() => <g />}
              isAnimationActive={false}
              tooltipType="none"
            />
          )}
          <Scatter
            data={points}
            shape={(p: object) => <Dot {...(p as { cx?: number; cy?: number; payload?: CorrelationPoint })} activeId={activeId} />}
            onMouseEnter={(p: { payload?: CorrelationPoint }) => onHover?.(p.payload?.id ?? null)}
            onMouseLeave={() => onHover?.(null)}
            onClick={(p: { payload?: CorrelationPoint }) => p.payload && onPointClick?.(p.payload.id)}
            cursor={onPointClick ? "pointer" : undefined}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
