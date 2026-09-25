import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, Info, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const ICON: Record<string, { Icon: typeof Bell; className: string }> = {
  low_attendance: { Icon: AlertTriangle, className: "text-status-late" },
  attendance_alert: { Icon: AlertTriangle, className: "text-status-late" },
  leave_approved: { Icon: CheckCircle2, className: "text-status-present" },
  appeal_approved: { Icon: CheckCircle2, className: "text-status-present" },
  leave_rejected: { Icon: XCircle, className: "text-status-absent" },
  appeal_rejected: { Icon: XCircle, className: "text-status-absent" },
  general: { Icon: Info, className: "text-primary" },
};

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    enabled,
    queryFn: () => api.get<{ notifications: NotificationRow[]; unread: number }>("/notifications"),
  });
}

/** readOnly: parent view shows alerts without marking them read. */
export function NotificationList({ readOnly = false, limit = 6 }: { readOnly?: boolean; limit?: number }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useNotifications();
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const rows = (data?.notifications ?? []).slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
          Notifications
          {!!data?.unread && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground tabular-nums">
              {data.unread} new
            </span>
          )}
        </CardTitle>
        <CardDescription>Attendance alerts and leave decisions. Demo only — no SMS or email is sent.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load notifications.</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((n) => {
              const { Icon, className } = ICON[n.type] ?? ICON.general;
              return (
                <li key={n.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}>
                      {n.title}
                      {!n.read && <span className="sr-only"> (unread)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="pt-0.5 text-xs text-muted-foreground tabular-nums">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!readOnly && !n.read && (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n.id)}
                      className="self-start rounded px-2 py-1 text-xs text-primary hover:bg-muted"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
