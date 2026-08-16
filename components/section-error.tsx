
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";


export function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Section error boundary:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center"
    >
      <AlertTriangle className="size-10 text-status-late" aria-hidden="true" />
      <h1 className="text-xl font-semibold">This page didn&apos;t load</h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong fetching your data. This is usually temporary —
        try again, or use the navigation above to go elsewhere.
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
