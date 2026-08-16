
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  reviewLeaveRequest,
  type LeaveRequest,
  type LeaveActionState,
} from "@/lib/leave-requests";
import { firstRow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


export function PendingAppeals({ requests }: { requests: LeaveRequest[] }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [state, setState] = useState<LeaveActionState>({});

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    setState({});
    const result = await reviewLeaveRequest(id, decision);
    setState(result);
    setBusyId(null);
    if (!result.error) {
      qc.invalidateQueries({ queryKey: ["faculty-dashboard"] });
      qc.invalidateQueries({ queryKey: ["student-attendance"] });
      qc.invalidateQueries({ queryKey: ["student-dashboard"] });
      qc.invalidateQueries({ queryKey: ["parent-dashboard"] });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Pending Appeals
            {requests.length > 0 && (
              <Badge variant="late">{requests.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Students disputing absent, late, or left-early records for your
            sessions.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No pending appeals.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const student = r.student;
              const sess = r.session;
              const busy = busyId === r.id;
              return (
                <li
                  key={r.id}
                  className="rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">
                        {(student as unknown as { full_name?: string } | null)?.full_name ??
                          "Student"}
                        {(student as unknown as { roll_no?: string | null } | null)
                          ?.roll_no ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {
                              (student as unknown as { roll_no?: string | null })?.roll_no
                            }
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sess?.course ?? "—"}
                        {sess?.opened_at
                          ? ` · ${new Date(sess.opened_at).toLocaleDateString([], {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}`
                          : null}
                      </p>
                      <p className="text-sm text-foreground/90">{r.reason}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => decide(r.id, "approved")}
                        aria-label="Approve appeal"
                      >
                        {busy ? (
                          <LoaderCircle
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Check className="size-4 text-status-present" aria-hidden="true" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => decide(r.id, "rejected")}
                        aria-label="Reject appeal"
                      >
                        <X className="size-4 text-destructive" aria-hidden="true" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {state.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        {state.message && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
