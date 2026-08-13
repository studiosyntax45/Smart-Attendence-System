import { CheckCircle2, Clock, XCircle, LogOut, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus } from "@/lib/utils";


const CONFIG: Record<
  AttendanceStatus,
  { label: string; Icon: typeof CheckCircle2 }
> = {
  present: { label: "Present", Icon: CheckCircle2 },
  late: { label: "Late", Icon: Clock },
  absent: { label: "Absent", Icon: XCircle },
  partial: { label: "Left early", Icon: LogOut },
};

export function StatusPill({
  status,
  excused = false,
}: {
  status: AttendanceStatus;
  excused?: boolean;
}) {
  if (excused) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Shield className="size-3" aria-hidden="true" />
        Excused
      </Badge>
    );
  }
  const { label, Icon } = CONFIG[status];
  return (
    <Badge variant={status}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
