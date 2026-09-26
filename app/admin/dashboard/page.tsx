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
import { useDrillDown } from "@/components/drilldown";
import {
  peopleSpec,
  pendingLeaveSpec,
  recordsSpec,
  sessionsSpec,
  studentsSpec,
  type HealthStudent,
  type PendingAppeal,
  type PendingLeave,
  type RecordLite,
  type SessionLite,
} from "@/components/drill-specs";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { open } = useDrillDown();

  const { data, isPending: isLoading, isError, refetch } = useQuery({
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
        api.get<{ sessions: Array<SessionLite & { id: string }> }>("/sessions"),
        api.get<{ attendance: Array<RecordLite & { status: AttendanceStatus }> }>(`/attendance?from=${weekAgo.toLocaleDateString("en-CA")}`),
        api.get<{ courses: Array<{ code: string; name: string; semester: string; credits: string | number }> }>("/courses"),
        api.get<{
          totals: { present: number; late: number; partial: number; conducted: number };
          buckets: { good: number; warning: number; critical: number };
          students: HealthStudent[];
        }>("/attendance-health"),
        api.get<{ leaveApplications: PendingLeave[] }>("/leave-applications?status=pending"),
        api.get<{ leaveRequests: Array<PendingAppeal & { status: string }> }>("/leave-requests"),
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
      const pendingAppeals = (appealsRes.leaveRequests ?? []).filter((r) => r.status === "pending");

      const weekRows = (attendanceRes.attendance ?? [])
        .filter((a) => new Date(a.entryTime) >= weekAgo)
        .map((a) => ({ ...a, entry_time: a.entryTime }));

      return {
        courses: coursesRes.courses,
        courseCount: coursesRes.courses.length,
        openSessions: (sessionsRes.sessions ?? []).filter((s) => !s.closedAt),
        activeSessions: (sessionsRes.sessions ?? []).filter((s) => !s.closedAt).length,
        healthStudents: healthRes.students ?? [],
        leaveApps: leaveAppsRes.leaveApplications,
        pendingAppeals,
        avgAttendance,
        lowAttendance: healthRes.buckets.warning + healthRes.buckets.critical,
        criticalAttendance: healthRes.buckets.critical,
        pendingLeave: leaveAppsRes.leaveApplications.length + pendingAppeals.length,
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
  const dayIndex = (t: string) => Math.floor((new Date(t).getTime() - weekAgo.getTime()) / (24 * 60 * 60 * 1000));
  const people = (role: string) =>
    allUsers.filter((u) => u.role === role).map((u) => ({ id: u.id, name: u.full_name, rollNo: u.roll_no, role: u.role }));

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
        <KpiCard label="Students" value={String(studentCount)} countTo={studentCount} sub="Registered accounts" icon={<GraduationCap />} drill={peopleSpec("Students", people("student"), true)} />
        <KpiCard label="Faculty" value={String(facultyCount)} countTo={facultyCount} sub="Teaching accounts" icon={<ShieldCheck />} drill={peopleSpec("Faculty", people("faculty"), false)} />
        <KpiCard label="Courses" value={String(data.courseCount)} countTo={data.courseCount} sub="In the catalogue" icon={<BookOpen />}
          drill={{
            kind: "list",
            title: "Courses",
            columns: [
              { key: "code", label: "Code" },
              { key: "name", label: "Name" },
              { key: "semester", label: "Semester" },
              { key: "credits", label: "Credits", numeric: true },
            ],
            rows: data.courses.map((c) => ({ code: c.code, name: c.name, semester: c.semester, credits: String(c.credits) })),
            link: { to: "/faculty/courses", label: "Open Courses" },
          }}
        />
        <KpiCard
          label="Active sessions"
          value={String(data.activeSessions)}
          countTo={data.activeSessions}
          sub={`${sessionsToday} opened today · ${weekTotal} marks this week`}
          icon={<Radio />}
          tone={data.activeSessions > 0 ? "present" : "neutral"}
          drill={sessionsSpec("Open sessions", data.openSessions, { empty: "No session is open right now." })}
        />
        <KpiCard
          label="Average attendance"
          value={data.avgAttendance === null ? "—" : `${data.avgAttendance}%`}
          countTo={data.avgAttendance ?? undefined}
          suffix="%"
          sub="All closed sessions"
          icon={<Percent />}
          tone={data.avgAttendance === null ? "neutral" : data.avgAttendance >= 75 ? "present" : "late"}
          drill={studentsSpec("Attendance by student", data.healthStudents, { link: { to: "/admin/attendance", label: "Open Attendance" } })}
        />
        <KpiCard
          label="Low attendance"
          value={String(data.lowAttendance)}
          countTo={data.lowAttendance}
          sub={`${data.criticalAttendance} below 65% · view list`}
          icon={<AlertTriangle />}
          tone={data.criticalAttendance > 0 ? "absent" : data.lowAttendance > 0 ? "late" : "present"}
          drill={studentsSpec(
            "Students below 75%",
            data.healthStudents.filter((s) => s.status === "warning" || s.status === "critical"),
            { empty: "Every student is at 75% or above.", link: { to: "/faculty/attendance-health", label: "Open Attendance Health" } }
          )}
        />
        <KpiCard
          label="Pending leave"
          value={String(data.pendingLeave)}
          countTo={data.pendingLeave}
          sub="Leave requests + appeals"
          icon={<FileClock />}
          tone={data.pendingLeave > 0 ? "late" : "neutral"}
          drill={pendingLeaveSpec(data.leaveApps, data.pendingAppeals, { to: "/faculty/leave", label: "Open Leave & Appeals" })}
        />
        <KpiCard label="Geofences" value={String(geofences?.length ?? 0)} countTo={geofences?.length ?? 0} sub="Configured classrooms" icon={<MapPin />}
          drill={{
            kind: "list",
            title: "Geofences",
            columns: [
              { key: "room", label: "Room" },
              { key: "radius", label: "Radius", numeric: true },
              { key: "at", label: "Location" },
            ],
            rows: geofences.map((g) => ({ room: g.room_name, radius: `${g.radius_m} m`, at: `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}` })),
          }}
        />
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
            <StatusStackedBars
              data={days}
              onDayClick={(i) =>
                open(
                  recordsSpec(
                    `Marks on ${days[i].label}`,
                    weekRows.filter((r) => r.status !== "absent" && dayIndex(r.entryTime) === i)
                  )
                )
              }
            />
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
