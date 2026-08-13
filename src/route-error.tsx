import { useRouteError } from "react-router-dom";
import { SectionError } from "@/components/section-error";


export function RouteError() {
  const error = useRouteError();
  const err =
    error instanceof Error ? error : new Error("An unexpected error occurred.");
  return <SectionError error={err} reset={() => window.location.reload()} />;
}
