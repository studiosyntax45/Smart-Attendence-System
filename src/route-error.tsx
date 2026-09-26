import { useEffect, useState } from "react";
import { useRouteError } from "react-router-dom";
import { SectionError } from "@/components/section-error";
import { PageSkeleton } from "@/components/page-skeleton";

// Pages are separate chunks. After a rebuild or dev-server restart, a tab opened earlier
// asks for chunk files that no longer exist; loading the new index.html fixes it.
const STALE_CHUNK =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;
const RELOAD_KEY = "pes-chunk-reload-at";

function isStaleChunkError(error: unknown): boolean {
  return error instanceof Error && STALE_CHUNK.test(error.message);
}

function reloadedRecently(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < 10_000;
  } catch {
    return false;
  }
}

/** Reloads the page, at most once per 10 s so a genuinely missing file can't loop. */
function reloadForNewBuild(): boolean {
  if (reloadedRecently()) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: without the guard, only reload once per page lifetime.
    if ((window as { __pesReloaded?: boolean }).__pesReloaded) return false;
    (window as { __pesReloaded?: boolean }).__pesReloaded = true;
  }
  window.location.reload();
  return true;
}

export function RouteError() {
  const error = useRouteError();
  // Decided once, from a pure read, so StrictMode's double render agrees with itself.
  const [reloading] = useState(() => isStaleChunkError(error) && !reloadedRecently());

  useEffect(() => {
    if (reloading) reloadForNewBuild();
  }, [reloading]);

  if (reloading) return <PageSkeleton />;
  const err =
    error instanceof Error ? error : new Error("An unexpected error occurred.");
  return <SectionError error={err} reset={() => window.location.reload()} />;
}
