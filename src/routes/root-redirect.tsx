import { Navigate } from "react-router-dom";
import { useAuth, roleHome } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";


export default function RootRedirect() {
  const { loading, user, profile } = useAuth();
  if (loading) return <PageSkeleton />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(profile.role)} replace />;
}
