
import { useQuery } from "@tanstack/react-query";
import { CalendarRange } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { listAllSchedule } from "@/lib/class-schedule";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import {
  ScheduleManager,
  type FacultyOption,
  type GeofenceOption,
  type CourseOption,
  type ClassOption,
} from "@/components/admin/schedule-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminSchedulePage() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-schedule", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      try {
        const [entriesRes, facultyRes, geofencesRes, coursesRes, classListRes] = await Promise.allSettled([
          listAllSchedule(),
          api.get<{ profiles: { id: string; fullName: string }[] }>("/profiles?role=faculty"),
          api.get<{ geofences: { id: string; roomName: string }[] }>("/geofences"),
          api.get<{ courses: { code: string; name: string }[] }>("/courses"),
          api.get<{ classes: { id: string; name: string; branch: string; semester: string; section: string }[] }>("/classes"),
        ]);

        const entries = entriesRes.status === "fulfilled" ? entriesRes.value : [];
        const faculty: FacultyOption[] =
          facultyRes.status === "fulfilled" && facultyRes.value.profiles
            ? facultyRes.value.profiles.map((p) => ({ id: p.id, full_name: p.fullName }))
            : [];
        const geofences: GeofenceOption[] =
          geofencesRes.status === "fulfilled" && geofencesRes.value.geofences
            ? geofencesRes.value.geofences.map((g) => ({ id: g.id, room_name: g.roomName }))
            : [];
        const courses: CourseOption[] =
          coursesRes.status === "fulfilled" && coursesRes.value.courses
            ? coursesRes.value.courses.map((c) => ({ code: c.code, name: c.name }))
            : [];
        const classList: ClassOption[] =
          classListRes.status === "fulfilled" && classListRes.value.classes
            ? classListRes.value.classes.map((c) => ({
                id: c.id,
                name: c.name,
                branch: c.branch,
                semester: c.semester,
                section: c.section,
              }))
            : [];

        if (entriesRes.status === "rejected") {
          console.error("Error fetching schedule entries:", entriesRes.reason);
        }

        return {
          entries,
          faculty,
          geofences,
          courses,
          classList,
        };
      } catch (err) {
        console.error("Failed to load admin schedule page:", err);
        return {
          entries: [],
          faculty: [],
          geofences: [],
          courses: [],
          classList: [],
        };
      }
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load the timetable.")}
        reset={() => refetch()}
      />
    );

  return (
    <GsapReveal className="w-full space-y-6">
      <PageTitle title="Class Timetable" />
      <div>
        <h1 className="text-2xl font-bold">Class Timetable</h1>
        <p className="text-sm text-muted-foreground">
          Weekly recurring slots for class sections. Faculty see today&apos;s classes on their
          dashboard and can open a session in one tap.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Weekly schedule
          </CardTitle>
          <CardDescription>
            Schedule slots per class section, faculty, and room geofence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleManager
            entries={data.entries}
            faculty={data.faculty}
            geofences={data.geofences}
            courses={data.courses}
            classList={data.classList}
          />
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
