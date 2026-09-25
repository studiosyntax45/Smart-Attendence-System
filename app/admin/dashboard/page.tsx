
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  FileClock,
  GraduationCap,
  MapPin,
  Percent,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { KpiCard } from "@/components/kpi-card";
import { GsapReveal } from "@/components/gsap-reveal";
import { UsersTable, type UserRow } from "@/components/admin/users-table";
import {
  GeofenceManager,
  type GeofenceRow,
} from "@/components/admin/geofence-manager";
import {
  StatusStackedBars,
  type DayStatusDatum,
} from "@/components/charts/status-stacked-bars";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startOfToday, type AttendanceStatus } from "@/lib/utils";

export default function AdminDashboard() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const todayStart = startOfToday();
      const weekAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

      const [
        usersRes,
        geofencesRes,
        sessionsRes,
        attendanceRes,
        coursesRes,
        healthRes,
        leaveAppsRes,
        appealsRes,
      ] = await Promise.all([
        api.get<{ profiles: Array<{ id: string; fullName: string; rollNo: string | null; role: string; createdAt?: string; faceEnrolled: boolean }> }>("/profiles"),
        api.get<{ geofences: Array<{ id: string; roomName: string; lat: number; lng: number; radiusM: number }> }>("/geofences"),
        api.get<{ sessions: Array<{ id: string; openedAt: string; closedAt: string | null }> }>("/sessions"),
        api.get<{ attendance: Array<{ entryTime: string; status: AttendanceStatus }> }>("/attendance"),
        api.get<{ courses: unknown[] }>("/courses"),
        api.get<{
          totals: { present: number; late: number; partial: number; conducted: number };
          buckets: { good: number; warning: number; critical: number };
        }>("/attendance-health"),
        api.get<{ leaveApplications: unknown[] }>("/leave-applications?status=pending"),
        api.get<{ leaveRequests: Array<{ status: string }> }>("/leave-requests"),
      ]);
      const t = healthRes.totals;
      const avgAttendance = t.conducted === 0 ? null : Math.round((100 * (t.present + t.late + t.partial)) / t.conducted);

      const users: UserRow[] = (usersRes.profiles ?? []).map((u) => ({
        id: u.id,
        full_name: u.fullName,
        roll_no: u.rollNo,
        role: u.role as UserRow["role"],
        created_at: u.createdAt ?? new Date().toISOString(),
        face_enrolled: u.faceEnrolled,
      }));

      const geofences: GeofenceRow[] = (geofencesRes.geofences ?? []).map((g) => ({
        id: g.id,
        room_name: g.roomName,
        lat: Number(g.lat),
        lng: Number(g.lng),
        radius_m: g.radiusM,
      }));

      const sessionsToday = (sessionsRes.sessions ?? []).filter(
        (s) => new Date(s.openedAt) >= todayStart
      ).length;

      const weekRows = (attendanceRes.attendance ?? [])
        .filter((a) => new Date(a.entryTime) >= weekAgo)
        .map((a) => ({
          entry_time: a.entryTime,
          status: a.status,
        }));

      return {
        courseCount: coursesRes.courses.length,
        activeSessions: (sessionsRes.sessions ?? []).filter((s) => !s.closedAt).length,
        avgAttendance,
        lowAttendance: healthRes.buckets.warning + healthRes.buckets.critical,
        criticalAttendance: healthRes.buckets.critical,
        pendingLeave:
          leaveAppsRes.leaveApplications.length +
          (appealsRes.leaveRequests ?? []).filter((r) => r.status === "pending").length,
        users: users ?? [],
        geofences: geofences ?? [],
        sessionsToday: sessionsToday ?? 0,
        weekRows: weekRows ?? [],
        weekAgo,
      };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load the admin dashboard.")}
        reset={() => refetch()}
      />
    );

  const allUsers = data.users;
  const geofences = data.geofences;
  const sessionsToday = data.sessionsToday;
  const weekRows = data.weekRows;
  const weekAgo = data.weekAgo;

  const studentCount = allUsers.filter((u) => u.role === "student").length;
  const facultyCount = allUsers.filter((u) => u.role === "faculty").length;

  const days: DayStatusDatum[] = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
    return {
      label: day.toLocaleDateString([], { weekday: "short", day: "numeric" }),
      present: 0,
      late: 0,
      partial: 0,
    };
  });
  for (const row of weekRows) {
    const idx = Math.floor(
      (new Date(row.entry_time).getTime() - weekAgo.getTime()) /
        (24 * 60 * 60 * 1000)
    );
    if (idx >= 0 && idx < 7 && row.status !== "absent") {
      days[idx][row.status] += 1;
    }
  }
  const weekTotal = days.reduce((s, d) => s + d.present + d.late + d.partial, 0);

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Admin Dashboard" />
      <div>
        <h1 className="text-2xl font-bold">
          Hello, {profile.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Institution overview · user &amp; geofence management
        </p>
      </div>

      
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Students" value={String(studentCount)} countTo={studentCount} sub="Registered accounts" icon={<GraduationCap />} />
        <KpiCard label="Faculty" value={String(facultyCount)} countTo={facultyCount} sub="Teaching accounts" icon={<ShieldCheck />} />
        <KpiCard label="Courses" value={String(data.courseCount)} countTo={data.courseCount} sub="In the catalogue" icon={<BookOpen />} href="/faculty/courses" />
        <KpiCard
          label="Active sessions"
          value={String(data.activeSessions)}
          countTo={data.activeSessions}
          sub={`${sessionsToday} opened today · ${weekTotal} marks this week`}
          icon={<Radio />}
          tone={data.activeSessions > 0 ? "present" : "neutral"}
        />
        <KpiCard
          label="Average attendance"
          value={data.avgAttendance === null ? "—" : `${data.avgAttendance}%`}
          countTo={data.avgAttendance ?? undefined}
          suffix="%"
          sub="All closed sessions"
          icon={<Percent />}
          tone={data.avgAttendance === null ? "neutral" : data.avgAttendance >= 75 ? "present" : "late"}
          href="/admin/attendance"
        />
        <KpiCard
          label="Low attendance"
          value={String(data.lowAttendance)}
          countTo={data.lowAttendance}
          sub={`${data.criticalAttendance} below 65% · view list`}
          icon={<AlertTriangle />}
          tone={data.criticalAttendance > 0 ? "absent" : data.lowAttendance > 0 ? "late" : "present"}
          href="/faculty/attendance-health"
        />
        <KpiCard
          label="Pending leave"
          value={String(data.pendingLeave)}
          countTo={data.pendingLeave}
          sub="Leave requests + appeals"
          icon={<FileClock />}
          tone={data.pendingLeave > 0 ? "late" : "neutral"}
          href="/faculty/leave"
        />
        <KpiCard label="Geofences" value={String(geofences?.length ?? 0)} countTo={geofences?.length ?? 0} sub="Configured classrooms" icon={<MapPin />} />
      </div>

      
      {weekTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>This week&apos;s attendance</CardTitle>
            <CardDescription>
              Marks per day by status — last 7 days, campus-wide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusStackedBars data={days} />
          </CardContent>
        </Card>
      )}

      
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Users &amp; roles</CardTitle>
            <CardDescription>
              Change roles and reset forgotten passwords. Your own role is locked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No users yet — accounts appear here after sign-up.
              </p>
            ) : (
              <UsersTable users={allUsers} currentUserId={profile.id} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classroom geofences</CardTitle>
            <CardDescription>
              Stand in the classroom and tap “Use my current location” for
              exact coordinates. Map-pin editing arrives in Phase 2.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeofenceManager geofences={geofences ?? []} />
          </CardContent>
        </Card>
      </div>
    </GsapReveal>
  );
}
