import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, roleHome } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";
import type { Role } from "@/lib/utils";


export function RequireRole({ allowed }: { allowed: Role[] }) {
  const { loading, user, profile } = useAuth();
  const location = useLocation();

  if (loading) return <PageSkeleton />;
  if (!user || !profile) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!allowed.includes(profile.role)) {
    return <Navigate to={roleHome(profile.role)} replace />;
  }
  return (
    <AppShell role={profile.role} userName={profile.fullName}>
      <Outlet />
    </AppShell>
  );
}


export function RequireParentView() {
  const { loading, user, profile, parentView } = useAuth();

  if (loading) return <PageSkeleton />;
  if (!parentView || !user || !profile || profile.role !== "student") {
    return <Navigate to="/parent-login" replace />;
  }
  return (
    <AppShell role="parent" userName={profile.fullName}>
      <Outlet />
    </AppShell>
  );
}
