import { CheckCircle2, Clock, Undo2, XCircle } from "lucide-react";

type Status = "pending" | "approved" | "rejected" | "withdrawn";

const STYLE: Record<Status, { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-status-late/10 text-status-late", Icon: Clock },
  approved: { label: "Approved", className: "bg-status-present/10 text-status-present", Icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-status-absent/10 text-status-absent", Icon: XCircle },
  withdrawn: { label: "Withdrawn", className: "bg-muted text-muted-foreground", Icon: Undo2 },
};

export function LeaveStatusPill({ status }: { status: Status }) {
  const { label, className, Icon } = STYLE[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
