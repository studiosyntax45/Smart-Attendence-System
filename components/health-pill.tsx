import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";

export type HealthLevel = "good" | "warning" | "critical" | "none";

const STYLE: Record<HealthLevel, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  good: { label: "Good", className: "bg-status-present/10 text-status-present", Icon: CheckCircle2 },
  warning: { label: "Warning", className: "bg-status-late/10 text-status-late", Icon: AlertTriangle },
  critical: { label: "Critical", className: "bg-status-absent/10 text-status-absent", Icon: XCircle },
  none: { label: "No classes yet", className: "bg-muted text-muted-foreground", Icon: CircleDashed },
};

/** Icon + label, never colour alone. */
export function HealthPill({ level }: { level: HealthLevel }) {
  const { label, className, Icon } = STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
