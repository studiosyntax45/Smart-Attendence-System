import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { ApiError, onApiWrite } from "@/lib/api-client";

// Network errors and 5xx are usually the API restarting: keep trying for about 30 s.
// A 4xx will not change on retry, so fail fast.
function retry(failureCount: number, error: unknown): boolean {
  const status = error instanceof ApiError ? error.status : 0;
  return (status === 0 || status >= 500) && failureCount < 5;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry, retryDelay: (n) => Math.min(1000 * 2 ** n, 5000) } },
        queryCache: new QueryCache({
          // 401 here means the refresh token was rejected too: the session is over.
          onError: (error) => {
            if (error instanceof ApiError && error.status === 401 && !location.pathname.includes("login")) {
              const parent = localStorage.getItem("pes-parent-view") === "1";
              location.assign(parent ? "/parent-login" : `/login?next=${encodeURIComponent(location.pathname)}`);
            }
          },
        }),
      })
  );

  // Any change can show up on several screens (a closed session moves attendance, health,
  // dashboards and drill-downs). Mark everything stale; only what is on screen refetches.
  // In an effect, not the initializer: StrictMode runs initializers twice and keeps one.
  useEffect(() => onApiWrite(() => queryClient.invalidateQueries()), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
