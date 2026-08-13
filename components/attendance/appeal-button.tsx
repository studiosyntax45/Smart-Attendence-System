
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  MessageSquareWarning,
  X,
} from "lucide-react";
import {
  fileLeaveRequest,
  type LeaveActionState,
  type LeaveStatus,
} from "@/lib/leave-requests";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";


export function AppealControl({
  sessionId,
  leaveStatus,
}: {
  sessionId: string;
  leaveStatus?: LeaveStatus | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<LeaveActionState>({});

  if (leaveStatus === "pending") {
    return (
      <Badge variant="late">
        Pending review
      </Badge>
    );
  }
  if (leaveStatus === "approved") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Approved Ã¢â‚¬â€ excused
      </Badge>
    );
  }
  if (leaveStatus === "rejected") {
    return (
      <Badge variant="absent">
        Rejected
      </Badge>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setState({});
    const res = await fileLeaveRequest(sessionId, reason);
    setState(res);
    setPending(false);
    if (!res.error) {
      qc.invalidateQueries({ queryKey: ["student-attendance"] });
      qc.invalidateQueries({ queryKey: ["student-dashboard"] });
      setOpen(false);
      setReason("");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setState({});
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageSquareWarning className="size-3" aria-hidden="true" />
        Appeal
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appeal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 id="appeal-title" className="text-base font-semibold">
                  Appeal attendance
                </h2>
                <p className="text-xs text-muted-foreground">
                  Explain why this session should be excused (5Ã¢â‚¬â€œ500 characters).
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="appeal-reason">Reason</Label>
                <textarea
                  id="appeal-reason"
                  required
                  minLength={5}
                  maxLength={500}
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Medical appointment with certificateÃ¢â‚¬Â¦"
                  className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  {reason.trim().length}/500
                </p>
              </div>

              {state.error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  {state.error}
                </p>
              )}
              {state.message && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
                >
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  {state.message}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? (
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {pending ? "SubmittingÃ¢â‚¬Â¦" : "Submit appeal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
