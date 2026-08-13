
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  GraduationCap,
  MapPin,
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
      ] = await Promise.all([
        api.get<{ profiles: Array<{ id: string; fullName: string; rollNo: string | null; role: string; createdAt?: string; faceEnrolled: boolean }> }>("/profiles"),
        api.get<{ geofences: Array<{ id: string; roomName: string; lat: number; lng: number; radiusM: number }> }>("/geofences"),
        api.get<{ sessions: Array<{ id: string; openedAt: string }> }>("/sessions"),
        api.get<{ attendance: Array<{ entryTime: string; status: AttendanceStatus }> }>("/attendance"),
      ]);

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
  const staffCount = allUsers.filter((u) => u.role !== "student").length;

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
          Institution overview Ã‚Â· user &amp; geofence management
        </p>
      </div>

      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Students"
          value={String(studentCount)}
          countTo={studentCount}
          sub="Registered accounts"
          icon={<GraduationCap />}
        />
        <KpiCard
          label="Staff"
          value={String(staffCount)}
          countTo={staffCount}
          sub="Faculty + admins"
          icon={<ShieldCheck />}
        />
        <KpiCard
          label="Geofences"
          value={String(geofences?.length ?? 0)}
          countTo={geofences?.length ?? 0}
          sub="Configured classrooms"
          icon={<MapPin />}
        />
        <KpiCard
          label="Sessions today"
          value={String(sessionsToday ?? 0)}
          countTo={sessionsToday ?? 0}
          sub={`${weekTotal} marks this week`}
          icon={<CalendarDays />}
        />
      </div>

      
      {weekTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>This week&apos;s attendance</CardTitle>
            <CardDescription>
              Marks per day by status Ã¢â‚¬â€ last 7 days, campus-wide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusStackedBars data={days} />
          </CardContent>
        </Card>
      )}

      
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users &amp; roles</CardTitle>
            <CardDescription>
              Promote users to faculty or admin. Your own role is locked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No users yet Ã¢â‚¬â€ accounts appear here after sign-up.
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
              Stand in the classroom and tap Ã¢â‚¬Å“Use my current locationÃ¢â‚¬Â for
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
