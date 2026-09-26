import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, LogIn, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL, ApiError } from "@/lib/api-client";

/**
 * Pages pass a generic "Could not load X" error, so the underlying ApiError is
 * taken from `error.cause` when set, otherwise from the most recently failed query.
 */
function useUnderlyingError(error: Error): unknown {
  const queryClient = useQueryClient();
  return useMemo(() => {
    if (error.cause !== undefined) return error.cause;
    if (error instanceof ApiError) return error;
    const failed = queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.status === "error" && q.state.error)
      .sort((a, b) => b.state.errorUpdatedAt - a.state.errorUpdatedAt);
    return failed[0]?.state.error ?? null;
  }, [error, queryClient]);
}

function describe(cause: unknown): { hint: string; detail: string | null; signIn: boolean } {
  if (cause instanceof ApiError) {
    if (cause.status === 0) {
      return {
        hint: `Can't reach the server at ${API_BASE_URL}. Make sure the backend is running (npm --prefix server run dev).`,
        detail: cause.message,
        signIn: false,
      };
    }
    if (cause.status === 401) {
      return { hint: "Your session has expired. Sign in again to continue.", detail: null, signIn: true };
    }
    if (cause.status === 403) {
      return { hint: "Your account doesn't have access to this data.", detail: cause.message, signIn: false };
    }
    if (cause.status >= 500) {
      return {
        hint: "The server hit an error. Check the backend terminal for details.",
        detail: `${cause.status}: ${cause.message}`,
        signIn: false,
      };
    }
    return { hint: "The server rejected the request.", detail: `${cause.status}: ${cause.message}`, signIn: false };
  }
  if (cause instanceof Error) {
    return { hint: "Something went wrong while loading this page.", detail: cause.message, signIn: false };
  }
  return {
    hint: "Something went wrong fetching your data. Try again, or use the navigation above to go elsewhere.",
    detail: null,
    signIn: false,
  };
}

export function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const navigate = useNavigate();
  const cause = useUnderlyingError(error);
  const { hint, detail, signIn } = describe(cause);

  useEffect(() => {
    console.error("Section error boundary:", error, cause);
  }, [error, cause]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center"
    >
      <AlertTriangle className="size-10 text-status-late" aria-hidden="true" />
      <h1 className="text-xl font-semibold">This page didn&apos;t load</h1>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {detail && (
        <p className="break-words rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
          {detail}
        </p>
      )}
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          Ref: {error.digest}
        </p>
      )}
      {signIn ? (
        <Button
          onClick={() => navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`)}
          variant="outline"
        >
          <LogIn className="size-4" aria-hidden="true" />
          Sign in again
        </Button>
      ) : (
        <Button onClick={reset} variant="outline">
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
