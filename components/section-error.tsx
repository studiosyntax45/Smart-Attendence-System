import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RotateCcw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api-client";

const HEALTH_POLL_MS = 3000;

async function apiUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_BASE_URL}/health`, { cache: "no-store" })).ok;
  } catch {
    return false;
  }
}

export function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [serverDown, setServerDown] = useState(false);
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    console.error("Section error boundary:", error);
  }, [error]);

  // If the API is unreachable, say so and reload the section as soon as it answers again.
  useEffect(() => {
    let stopped = false;
    let wasDown = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const up = await apiUp();
      if (stopped) return;
      setServerDown(!up);
      if (up && wasDown) resetRef.current();
      if (!up) timer = setTimeout(check, HEALTH_POLL_MS);
      wasDown = !up;
    };
    check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center"
    >
      {serverDown ? (
        <ServerOff className="size-10 text-status-late" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-10 text-status-late" aria-hidden="true" />
      )}
      <h1 className="text-xl font-semibold">
        {serverDown ? "Can't reach the server" : "This page didn't load"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {serverDown ? (
          <>
            The API at <span className="font-mono">{API_BASE_URL}</span> is not answering. If you are running the demo,
            start it with <span className="font-mono">npm run dev</span> in the <span className="font-mono">server</span>{" "}
            folder. This page reloads by itself once it is back.
          </>
        ) : (
          <>{error.message} Try again, or use the navigation above to go elsewhere.</>
        )}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          Ref: {error.digest}
        </p>
      )}
      <Button onClick={reset} variant="outline">
        <RotateCcw className="size-4" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
