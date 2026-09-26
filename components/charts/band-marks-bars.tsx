import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BAND_COLOR } from "@/components/charts/correlation-scatter";
import type { HealthLevel } from "@/components/health-pill";

export interface BandDatum {
  band: HealthLevel;
  label: string;
  avgMarks: number | null;
  count: number;
}

/** Average marks per attendance band: the correlation in three numbers anyone can check against the table. */
export function BandMarksBars({ data, onBandClick }: { data: BandDatum[]; onBandClick?: (band: HealthLevel) => void }) {
  const rows = data.map((d) => ({ ...d, tick: `${d.label} (${d.count})`, value: d.avgMarks ?? 0 }));
  return (
    <div className="h-80 w-full" role="img" aria-label={data.map((d) => `${d.label}: ${d.count} students, average marks ${d.avgMarks ?? "none"}%`).join("; ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 8, left: -8, bottom: 8 }} onClick={(e: { activeTooltipIndex?: number | string | null } | null) => { if (e?.activeTooltipIndex != null) onBandClick?.(rows[Number(e.activeTooltipIndex)].band); }} style={onBandClick ? { cursor: "pointer" } : undefined}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <XAxis dataKey="tick" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval={0} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={48} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as BandDatum;
              return (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-pop">
                  <p className="font-medium text-card-foreground">Attendance {d.label}</p>
                  <p className="text-muted-foreground tabular-nums">
                    {d.count} student{d.count === 1 ? "" : "s"} · average marks{" "}
                    <span className="font-mono text-card-foreground">{d.avgMarks === null ? "—" : `${d.avgMarks}%`}</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
            {rows.map((d) => (
              <Cell key={d.band} fill={BAND_COLOR[d.band]} />
            ))}
            <LabelList
              dataKey="avgMarks"
              position="top"
              formatter={(v: number | null) => (v === null ? "—" : `${v}%`)}
              style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
