
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Play,
  Radio,
} from "lucide-react";
import {
  openSession,
  type SessionFormState,
} from "@/app/faculty/dashboard/actions";
import {
  formatTimeRange,
  type ScheduleEntry,
} from "@/lib/class-schedule";
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

interface TodaysClassesProps {
  entries: ScheduleEntry[];
  
  liveCourses: Set<string>;
  
  hasOpenSession: boolean;
}


export function TodaysClasses({
  entries,
  liveCourses,
  hasOpenSession,
}: TodaysClassesProps) {
  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [state, setState] = useState<SessionFormState>({});

  async function openFromSchedule(entry: ScheduleEntry) {
    setPendingId(entry.id);
    setState({});
    const fd = new FormData();
    fd.set("course", entry.course);
    fd.set("geofenceId", entry.geofence_id);
    const result = await openSession({}, fd);
    setState(result);
    setPendingId(null);
    if (result.message) {
      qc.invalidateQueries({ queryKey: ["faculty-dashboard"] });
      qc.invalidateQueries({ queryKey: ["mark-attendance"] });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Classes</CardTitle>
        <CardDescription>
          From your weekly timetable — open a session in one tap.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No classes scheduled for today. Open an ad-hoc session below, or
            ask an admin to add your timetable.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => {
              const room = firstRow(e.geofences)?.room_name;
              const isLive = liveCourses.has(e.course);
              const opening = pendingId === e.id;
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate font-medium">{e.course}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatTimeRange(e.start_time, e.end_time)}
                      {room ? (
                        <span className="inline-flex items-center gap-1">
                          {" · "}
                          <MapPin className="inline size-3" aria-hidden="true" />
                          {room}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {isLive ? (
                    <Badge variant="present" className="shrink-0">
                      <Radio className="size-3" aria-hidden="true" />
                      Live
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={opening || hasOpenSession}
                      title={
                        hasOpenSession
                          ? "Close the live session before opening another"
                          : undefined
                      }
                      onClick={() => openFromSchedule(e)}
                    >
                      {opening ? (
                        <LoaderCircle
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Play className="size-4" aria-hidden="true" />
                      )}
                      {opening ? "Opening…" : "Open Session"}
                    </Button>
                  )}
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
