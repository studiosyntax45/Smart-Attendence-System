import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireRole, RequireParentView } from "@/src/guards";
import { RouteError } from "@/src/route-error";
import RootRedirect from "@/src/routes/root-redirect";
import AuthCallback from "@/src/routes/auth-callback";
import LoginPage from "@/app/(auth)/login/page";
import ParentLoginPage from "@/app/(auth)/parent-login/page";
import StudentDashboard from "@/app/student/dashboard/page";
import StudentAttendance from "@/app/student/attendance/page";
import StudentResults from "@/app/student/results/page";
import StudentMarkAttendance from "@/app/student/mark-attendance/page";
import StudentEnrollFace from "@/app/student/enroll-face/page";
import StudentProfile from "@/app/student/profile/page";
import FacultyDashboard from "@/app/faculty/dashboard/page";
import FacultyAttendance from "@/app/faculty/attendance/page";
import FacultyCourses from "@/app/faculty/courses/page";
import FacultyMarks from "@/app/faculty/marks/page";
import FacultyPerformance from "@/app/faculty/performance/page";
import AdminDashboard from "@/app/admin/dashboard/page";
import AdminClasses from "@/app/admin/classes/page";
import AdminAttendance from "@/app/admin/attendance/page";
import AdminSettings from "@/app/admin/settings/page";
import AdminSchedule from "@/app/admin/schedule/page";
import ParentDashboard from "@/app/parent/dashboard/page";

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <LoginPage />, errorElement: <RouteError /> },
  { path: "/parent-login", element: <ParentLoginPage />, errorElement: <RouteError /> },
  { path: "/auth/callback", element: <AuthCallback /> },

  {
    element: <RequireRole allowed={["student"]} />,
    errorElement: <RouteError />,
    children: [
      { path: "/student/dashboard", element: <StudentDashboard /> },
      { path: "/student/attendance", element: <StudentAttendance /> },
      { path: "/student/results", element: <StudentResults /> },
      { path: "/student/mark-attendance", element: <StudentMarkAttendance /> },
      { path: "/student/enroll-face", element: <StudentEnrollFace /> },
      { path: "/student/profile", element: <StudentProfile /> },
    ],
  },

  {
    element: <RequireRole allowed={["faculty", "admin"]} />,
    errorElement: <RouteError />,
    children: [
      { path: "/faculty/dashboard", element: <FacultyDashboard /> },
      { path: "/faculty/attendance", element: <FacultyAttendance /> },
      { path: "/faculty/courses", element: <FacultyCourses /> },
      { path: "/faculty/marks", element: <FacultyMarks /> },
      { path: "/faculty/performance", element: <FacultyPerformance /> },
    ],
  },

  {
    element: <RequireRole allowed={["admin"]} />,
    errorElement: <RouteError />,
    children: [
      { path: "/admin/dashboard", element: <AdminDashboard /> },
      { path: "/admin/classes", element: <AdminClasses /> },
      { path: "/admin/attendance", element: <AdminAttendance /> },
      { path: "/admin/schedule", element: <AdminSchedule /> },
      { path: "/admin/settings", element: <AdminSettings /> },
    ],
  },

  {
    element: <RequireParentView />,
    errorElement: <RouteError />,
    children: [{ path: "/parent/dashboard", element: <ParentDashboard /> }],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);
