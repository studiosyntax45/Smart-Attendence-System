
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, LoaderCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  openSession,
  type SessionFormState,
} from "@/app/faculty/dashboard/actions";

interface GeofenceOption {
  id: string;
  room_name: string;
  radius_m: number;
}

interface CourseOption {
  code: string;
  name: string;
}

const INITIAL: SessionFormState = {};

const selectClass =
  "flex h-11 w-full cursor-pointer rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OpenSessionForm({
  geofences,
  courses,
}: {
  geofences: GeofenceOption[];
  courses: CourseOption[];
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<SessionFormState>(INITIAL);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await openSession(state, formData);
    setState(result);
    setPending(false);
    if (result.message) {
      qc.invalidateQueries({ queryKey: ["faculty-dashboard"] });
      qc.invalidateQueries({ queryKey: ["mark-attendance"] });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="course">Course</Label>
        <select
          id="course"
          name="course"
          required
          defaultValue=""
          suppressHydrationWarning
          className={selectClass}
        >
          <option value="" disabled>
            Choose a courseÃ¢â‚¬Â¦
          </option>
          {courses.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        {courses.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No courses found. Create one on the{" "}
            <a href="/faculty/courses" className="underline">
              Courses
            </a>{" "}
            page first.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="geofenceId">Classroom geofence</Label>
        <select
          id="geofenceId"
          name="geofenceId"
          required
          defaultValue=""
          suppressHydrationWarning
          className={selectClass}
        >
          <option value="" disabled>
            Choose a roomÃ¢â‚¬Â¦
          </option>
          {geofences.map((g) => (
            <option key={g.id} value={g.id}>
              {g.room_name} (radius {g.radius_m} m)
            </option>
          ))}
        </select>
      </div>

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

      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
        {pending ? "OpeningÃ¢â‚¬Â¦" : "Open session"}
      </Button>
    </form>
  );
}
