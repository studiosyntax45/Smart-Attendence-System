import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { api } from "@/lib/api-client";

interface Attempt {
  id: string;
  name: string | null;
  usn: string | null;
  reason: string;
  at: string;
}

/** Scans the server refused for this session (wrong face, outside the room, not enrolled). Those students stay absent. */
export function RejectedAttempts({ sessionId }: { sessionId: string }) {
  const { data } = useQuery({
    queryKey: ["rejected-attempts", sessionId],
    queryFn: () => api.get<{ attempts: Attempt[] }>(`/attendance/rejected?sessionId=${sessionId}`).then((r) => r.attempts),
  });
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-status-absent/30 bg-status-absent/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-status-absent">
        <ShieldAlert className="size-4" aria-hidden="true" />
        Rejected attempts ({data.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        These scans were refused and not counted. The students stay absent unless they mark again successfully.
      </p>
      <ul className="mt-3 divide-y text-sm">
        {data.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span>
              <span className="font-medium">{a.name ?? "Unknown student"}</span>
              {a.usn && <span className="ml-2 font-mono text-xs text-muted-foreground">{a.usn}</span>}
              <span className="block text-muted-foreground sm:inline sm:before:content-['_·_']">{a.reason}</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
