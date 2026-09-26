import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Layers,
  Radio,
  Users,
  FileClock,
  GraduationCap,
  Percent,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { listScheduleForFaculty } from "@/lib/class-schedule";
import { listPendingLeaveRequests } from "@/lib/leave-requests";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { KpiCard } from "@/components/kpi-card";
import { StatusPill } from "@/components/status-pill";
import { GsapReveal } from "@/components/gsap-reveal";
import { OpenSessionForm } from "@/components/faculty/open-session-form";
import { CloseSessionButton } from "@/components/faculty/close-session-button";
import { RealtimeRoster } from "@/components/faculty/realtime-roster";
import { TodaysClasses } from "@/components/faculty/todays-classes";
import { PendingAppeals } from "@/components/faculty/pending-appeals";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, startOfToday, type AttendanceStatus } from "@/lib/utils";
import { clickable, useDrillDown } from "@/components/drilldown";
import {
  courseAveragesSpec,
  pendingLeaveSpec,
  recordsSpec,
  rollupStudents,
  sessionsSpec,
  studentsSpec,
  type HealthCourseRow,
  type PendingLeave,
} from "@/components/drill-specs";

type AttendanceRes = { attendance: Array<{ id: string; sessionId: string; studentId: string; entryTime: string; exitTime: string | null; status: AttendanceStatus; faceConfidence: number | null; excused?: boolean; student?: { id: string; fullName: string; rollNo: string | null }; session?: { course: string } }> };

interface RosterRow {
  id: string;
  student_id: string;
  entry_time: string;
  exit_time: string | null;
  status: AttendanceStatus;
  face_confidence: number | null;
  excused?: boolean;
  profiles: { full_name: string; roll_no: string | null } | null;
}

export default function FacultyDashboard() {
  const { profile } = useAuth();
  const [adhocOpen, setAdhocOpen] = useState(false);
  const { open } = useDrillDown();

  const { data, isPending: isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-dashboard", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const todayStart = startOfToday();
      const todayDayOfWeek = todayStart.getDay();

      const [
        sessionsRes,
        attendanceRes,
        geofencesRes,
        coursesRes,
        schedule,
        pendingAppeals,
        healthRes,
        leaveAppsRes,
      ] = await Promise.all([
        api.get<{ sessions: Array<{ id: string; course: string; openedAt: string; closedAt: string | null; geofence?: { roomName: string }; faculty?: { id: string; fullName: string } | null }> }>("/sessions"),
        // Today only: the full history is ~1 MB and this page shows today and the live session.
        api.get<AttendanceRes>(`/attendance?from=${todayStart.toLocaleDateString("en-CA")}`),
        api.get<{ geofences: Array<{ id: string; roomName: string; radiusM: number }> }>("/geofences"),
        api.get<{ courses: Array<{ code: string; name: string }> }>("/courses"),
        listScheduleForFaculty(profile!.id, todayDayOfWeek),
        listPendingLeaveRequests().catch(() => []),
        api
          .get<{ courseRows: HealthCourseRow[] }>("/attendance-health")
          .catch(() => ({ courseRows: [] })),
        api.get<{ leaveApplications: PendingLeave[] }>("/leave-applications?status=pending").catch(() => ({ leaveApplications: [] })),
      ]);

      const allSessions = sessionsRes.sessions ?? [];
      // Own session only; closing someone else's is refused.
      const openSessionRaw =
        allSessions.find((s) => !s.closedAt && (profile!.role === "admin" || s.faculty?.id === profile!.id)) ?? null;

      const myCourses = new Set([
        ...allSessions.filter((s) => s.faculty?.id === profile!.id).map((s) => s.course),
        ...schedule.map((c) => c.course),
      ]);
      const myRows = healthRes.courseRows.filter((r) => myCourses.has(r.courseCode));
      const myConducted = myRows.reduce((n, r) => n + r.conducted, 0);
      const myAttended = myRows.reduce((n, r) => n + r.attended, 0);
      const kpis = {
        myCourses: myCourses.size,
        myStudents: new Set(myRows.map((r) => r.studentId)).size,
        avgAttendance: myConducted === 0 ? null : Math.round((100 * myAttended) / myConducted),
        pendingLeave: pendingAppeals.length + leaveAppsRes.leaveApplications.length,
      };
      const openSession = openSessionRaw
        ? {
            id: openSessionRaw.id,
            course: openSessionRaw.course,
            opened_at: openSessionRaw.openedAt,
            geofences: openSessionRaw.geofence ? { room_name: openSessionRaw.geofence.roomName } : null,
          }
        : null;

      // A session left open since an earlier day is not in today's rows.
      const liveRecords = !openSession
        ? []
        : new Date(openSession.opened_at) >= todayStart
          ? attendanceRes.attendance.filter((a) => a.sessionId === openSession.id)
          : (await api.get<AttendanceRes>(`/attendance?sessionId=${openSession.id}`)).attendance;
      const roster: RosterRow[] = liveRecords.map((a) => ({
        id: a.id,
        student_id: a.studentId,
        entry_time: a.entryTime,
        exit_time: a.exitTime,
        status: a.status,
        face_confidence: a.faceConfidence,
        excused: a.excused,
        profiles: a.student ? { full_name: a.student.fullName, roll_no: a.student.rollNo } : null,
      }));

      const todayAttendance = (attendanceRes.attendance ?? []).filter(
        (a) => new Date(a.entryTime) >= todayStart
      );
      const sessionsTodayList = allSessions.filter((s) => new Date(s.openedAt) >= todayStart);
      const sessionsTodayCount = sessionsTodayList.length;

      const geofences = (geofencesRes.geofences ?? []).map((g) => ({
        id: g.id,
        room_name: g.roomName,
        radius_m: g.radiusM,
      }));

      const courses = coursesRes.courses ?? [];

      const liveCourses = new Set(
        allSessions
          .filter((s) => !s.closedAt && new Date(s.openedAt) >= todayStart)
          .map((s) => s.course)
      );

      return {
        openSession,
        roster,
        todayRows: todayAttendance,
        sessionsToday: sessionsTodayCount,
        sessionsTodayList,
        liveRecords,
        myRows,
        leaveApps: leaveAppsRes.leaveApplications,
        geofences,
        courses,
        schedule,
        pendingAppeals,
        liveCourses,
        kpis,
      };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load the faculty dashboard.")}
        reset={() => refetch()}
      />
    );

  const {
    openSession,
    roster,
    todayRows,
    sessionsToday,
    geofences,
    courses,
    schedule,
    pendingAppeals,
    liveCourses,
    kpis,
    sessionsTodayList,
    liveRecords,
    myRows,
    leaveApps,
  } = data;
  const liveSpec = recordsSpec(openSession ? `${openSession.course}: live roster` : "Live session", liveRecords, {
    empty: openSession ? "No students have marked yet." : "No session is open.",
  });
  const byCourse = courseAveragesSpec("Attendance by course", myRows, {
    link: { to: "/faculty/attendance-health", label: "Open Attendance Health" },
  });

  const today = todayRows;
  const presentToday = today.filter((r: { status: AttendanceStatus }) => r.status === "present").length;
  const lateToday = today.filter((r: { status: AttendanceStatus }) => r.status === "late").length;
  const markedToday = today.filter((r: { status: AttendanceStatus }) => r.status !== "absent").length;

  const fence = openSession?.geofences ?? null;

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Faculty Dashboard" />
      {openSession && <RealtimeRoster sessionId={openSession.id} />}

      <div>
        <h1 className="text-2xl font-bold">
          Hello, {profile.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {openSession
            ? "A session is live — the roster below updates automatically."
            : "No live session. Open one from today's timetable or ad-hoc below."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Live session"
          value={openSession ? openSession.course : "None"}
          sub={
            openSession
              ? `Since ${new Date(openSession.opened_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}${fence ? ` · ${fence.room_name}` : ""}`
              : "Open one below"
          }
          icon={<Radio />}
          tone={openSession ? "present" : "neutral"}
          drill={liveSpec}
        />
        <KpiCard
          label="Marked (live)"
          value={String(roster.length)}
          countTo={openSession ? roster.length : undefined}
          sub={openSession ? "Students so far" : "No live session"}
          icon={<Users />}
          drill={liveSpec}
        />
        <KpiCard
          label="My courses"
          value={String(kpis.myCourses)}
          countTo={kpis.myCourses}
          sub="Sessions or timetable slots"
          icon={<Layers />}
          drill={{ ...byCourse, title: "My courses" }}
        />
        <KpiCard
          label="Students"
          value={String(kpis.myStudents)}
          countTo={kpis.myStudents}
          sub="Enrolled in my courses"
          icon={<GraduationCap />}
          drill={studentsSpec("Students in my courses", rollupStudents(myRows))}
        />
        <KpiCard
          label="Today's sessions"
          value={String(sessionsToday ?? 0)}
          countTo={sessionsToday ?? 0}
          sub={`${schedule.length} on the timetable`}
          icon={<CalendarDays />}
          drill={sessionsSpec("Today's sessions", sessionsTodayList, { empty: "No sessions opened today." })}
        />
        <KpiCard
          label="Today's attendance"
          value={String(markedToday)}
          countTo={markedToday}
          sub={`${presentToday} present · ${lateToday} late`}
          icon={<CheckCircle2 />}
          tone="present"
          drill={recordsSpec("Today's marks", todayRows.filter((r) => r.status !== "absent"))}
        />
        <KpiCard
          label="Pending leave"
          value={String(kpis.pendingLeave)}
          countTo={kpis.pendingLeave}
          sub="Leave requests + appeals"
          icon={<FileClock />}
          tone={kpis.pendingLeave > 0 ? "late" : "neutral"}
          drill={pendingLeaveSpec(leaveApps, pendingAppeals, { to: "/faculty/leave", label: "Open Leave & Appeals" })}
        />
        <KpiCard
          label="Average attendance"
          value={kpis.avgAttendance === null ? "—" : `${kpis.avgAttendance}%`}
          countTo={kpis.avgAttendance ?? undefined}
          suffix="%"
          sub="My courses, closed sessions"
          icon={<Percent />}
          tone={kpis.avgAttendance === null ? "neutral" : kpis.avgAttendance >= 75 ? "present" : "late"}
          drill={byCourse}
        />
      </div>

      <PendingAppeals requests={pendingAppeals} />

      {openSession ? (

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <span className="relative flex size-2.5" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-present opacity-70" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-status-present" />
                </span>
                {openSession.course} — live roster
              </CardTitle>
              <CardDescription>
                {fence ? `Room “${fence.room_name}” · ` : ""}
                Updates live as students mark
              </CardDescription>
            </div>
            <CloseSessionButton sessionId={openSession.id} />
          </CardHeader>
          <CardContent>
            {roster.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No students have marked yet — the list fills in as entries
                arrive.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Roll no</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Entry</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Face conf.</th>
                      <th scope="col" className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr
                        key={r.id}
                        {...clickable(
                          () => open({ kind: "student", studentId: r.student_id, name: r.profiles?.full_name ?? "Student", usn: r.profiles?.roll_no }),
                          "border-b transition-colors last:border-0 hover:bg-muted/50"
                        )}
                      >
                        <td className="py-2.5 pr-4 font-medium">
                          {r.profiles?.full_name ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {r.profiles?.roll_no ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {new Date(r.entry_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {r.face_confidence !== null
                            ? `${Math.round(Number(r.face_confidence) * 100)}%`
                            : "—"}
                        </td>
                        <td className="py-2.5">
                          <StatusPill
                            status={r.status}
                            excused={r.excused === true}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (

        <div className="grid gap-4 lg:grid-cols-2">
          <TodaysClasses
            entries={schedule}
            liveCourses={liveCourses}
            hasOpenSession={false}
          />

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                How sessions work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Open a session from today&apos;s timetable (or ad-hoc below).</p>
              <p>
                2. Students mark entry with face + location verification; entries
                after 10 minutes are flagged <strong>Late</strong>.
              </p>
              <p>
                3. Students who leave early are marked <strong>Left early</strong>{" "}
                when they tap exit.
              </p>
              <p>
                4. Closing the session stamps an exit time for everyone still in
                class.
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="p-0">
              <button
                type="button"
                aria-expanded={adhocOpen}
                onClick={() => setAdhocOpen((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div>
                  <CardTitle className="text-base">
                    Open an ad-hoc session instead
                  </CardTitle>
                  <CardDescription>
                    Makeup classes or anything not on the weekly timetable.
                  </CardDescription>
                </div>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform",
                    adhocOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>
            </CardHeader>
            {adhocOpen && (
              <CardContent className="border-t pt-4">
                {geofences && geofences.length > 0 ? (
                  <OpenSessionForm geofences={geofences} courses={courses} />
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No geofences configured yet. Ask your administrator to add one.
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {openSession && (
        <TodaysClasses
          entries={schedule}
          liveCourses={liveCourses}
          hasOpenSession={true}
        />
      )}
    </GsapReveal>
  );
}
