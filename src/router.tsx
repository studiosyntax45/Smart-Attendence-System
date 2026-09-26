import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireRole, RequireParentView } from "@/src/guards";
import { RouteError } from "@/src/route-error";
import RootRedirect from "@/src/routes/root-redirect";
import AuthCallback from "@/src/routes/auth-callback";

// Each page is its own chunk, fetched on first visit (one bundle was 1.3 MB).
const page = (load: () => Promise<{ default: React.ComponentType }>) => () =>
  load().then((m) => ({ Component: m.default }));

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", lazy: page(() => import("@/app/(auth)/login/page")), errorElement: <RouteError /> },
  { path: "/forgot-password", lazy: page(() => import("@/app/(auth)/forgot-password/page")), errorElement: <RouteError /> },
  { path: "/parent-login", lazy: page(() => import("@/app/(auth)/parent-login/page")), errorElement: <RouteError /> },
  { path: "/auth/callback", element: <AuthCallback /> },

  {
    element: <RequireRole allowed={["student"]} />,
    errorElement: <RouteError />,
    children: [
      { path: "/student/dashboard", lazy: page(() => import("@/app/student/dashboard/page")) },
      { path: "/student/attendance", lazy: page(() => import("@/app/student/attendance/page")) },
      { path: "/student/results", lazy: page(() => import("@/app/student/results/page")) },
      { path: "/student/mark-attendance", lazy: page(() => import("@/app/student/mark-attendance/page")) },
      { path: "/student/enroll-face", lazy: page(() => import("@/app/student/enroll-face/page")) },
      { path: "/student/profile", lazy: page(() => import("@/app/student/profile/page")) },
      { path: "/student/leave", lazy: page(() => import("@/app/student/leave/page")) },
    ],
  },

  {
    element: <RequireRole allowed={["faculty", "admin"]} />,
    errorElement: <RouteError />,
    children: [
      { path: "/faculty/dashboard", lazy: page(() => import("@/app/faculty/dashboard/page")) },
      { path: "/faculty/attendance", lazy: page(() => import("@/app/faculty/attendance/page")) },
      { path: "/faculty/courses", lazy: page(() => import("@/app/faculty/courses/page")) },
      { path: "/faculty/marks", lazy: page(() => import("@/app/faculty/marks/page")) },
      { path: "/faculty/performance", lazy: page(() => import("@/app/faculty/performance/page")) },
      { path: "/faculty/attendance-health", lazy: page(() => import("@/app/faculty/attendance-health/page")) },
      { path: "/faculty/leave", lazy: page(() => import("@/app/faculty/leave/page")) },
      { path: "/faculty/imports", lazy: page(() => import("@/app/faculty/imports/page")) },
      { path: "/faculty/students", lazy: page(() => import("@/app/faculty/students/page")) },
    ],
  },

  {
    element: <RequireRole allowed={["admin"]} />,
    errorElement: <RouteError />,
    children: [
      { path: "/admin/dashboard", lazy: page(() => import("@/app/admin/dashboard/page")) },
      { path: "/admin/classes", lazy: page(() => import("@/app/admin/classes/page")) },
      { path: "/admin/attendance", lazy: page(() => import("@/app/admin/attendance/page")) },
      { path: "/admin/schedule", lazy: page(() => import("@/app/admin/schedule/page")) },
      { path: "/admin/settings", lazy: page(() => import("@/app/admin/settings/page")) },
      { path: "/admin/audit-logs", lazy: page(() => import("@/app/admin/audit-logs/page")) },
    ],
  },

  {
    element: <RequireParentView />,
    errorElement: <RouteError />,
    children: [{ path: "/parent/dashboard", lazy: page(() => import("@/app/parent/dashboard/page")) }],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);
