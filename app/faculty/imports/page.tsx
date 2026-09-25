import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { norm } from "@/lib/csv";
import { IMPORT_SPECS, type ImportSpecId } from "@/lib/import-specs";
import { BulkImport } from "@/components/bulk-import";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TABS: Array<{ id: ImportSpecId; adminOnly: boolean; endpoint: string; description: string; note?: string }> = [
  {
    id: "students",
    adminOnly: true,
    endpoint: "/imports/students",
    description: "Create new students or update existing ones, matched by USN. Nothing is duplicated.",
    note: "New students get the password Pes@12345; they can also sign in with Google using the same college email.",
  },
  {
    id: "faculty",
    adminOnly: true,
    endpoint: "/imports/faculty",
    description: "Create faculty accounts in one go, matched by email. Existing faculty get their name updated.",
    note: "New faculty get the password Pes@12345. Emails that already belong to a student or admin are rejected, not converted.",
  },
  {
    id: "courses",
    adminOnly: true,
    endpoint: "/imports/courses",
    description: "Create or update courses, matched by course code.",
  },
  {
    id: "enrollments",
    adminOnly: false,
    endpoint: "/imports/enrollments",
    description: "Enroll a whole class into courses at once. Already-enrolled pairs are skipped, not duplicated.",
  },
  {
    id: "timetable",
    adminOnly: true,
    endpoint: "/imports/timetable",
    description: "Load a whole week's timetable at once. The same teacher, day and start time updates the existing slot.",
    note: "Faculty see these slots under Today's Classes and can open a session in one tap.",
  },
  {
    id: "attendance",
    adminOnly: false,
    endpoint: "/imports/attendance",
    description: "Faculty/admin corrections for a session that already happened. Students still mark themselves with face + GPS.",
    note: "Each row is written to that course's session on that date, and the import is recorded in the audit log.",
  },
];

export default function ImportsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  const [active, setActive] = useState<ImportSpecId>(tabs[0]?.id ?? "enrollments");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["import-context"],
    enabled: !!profile,
    queryFn: async () => {
      const [profiles, courses, rooms, classes] = await Promise.all([
        api.get<{ profiles: Array<{ rollNo: string | null; role: string; email: string | null }> }>("/profiles"),
        api.get<{ courses: Array<{ code: string }> }>("/courses"),
        api.get<{ geofences: Array<{ roomName: string }> }>("/geofences"),
        api.get<{ classes: Array<{ name: string }> }>("/classes"),
      ]);
      const emails = profiles.profiles.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p.role] as const);
      return {
        knownUsns: new Set(profiles.profiles.filter((s) => s.role === "student" && s.rollNo).map((s) => norm(s.rollNo!))),
        knownCourses: new Set(courses.courses.map((c) => c.code.toUpperCase())),
        knownFaculty: new Set(emails.filter(([, r]) => r === "faculty" || r === "admin").map(([e]) => e)),
        knownRooms: new Set(rooms.geofences.map((r) => r.roomName.toLowerCase())),
        knownClasses: new Set(classes.classes.map((c) => c.name.toLowerCase())),
        knownEmails: new Map(emails),
      };
    },
  });
  const ctx = useMemo(() => data ?? { knownUsns: new Set<string>(), knownCourses: new Set<string>() }, [data]);

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError) return <SectionError error={new Error("Could not load students and courses.")} reset={() => refetch()} />;

  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  const spec = IMPORT_SPECS[tab.id];

  return (
    <div className="space-y-6">
      <PageTitle title="Bulk import" />
      <div>
        <h1 className="text-2xl font-bold">Bulk import</h1>
        <p className="text-sm text-muted-foreground">
          Download a template, fill it in, upload it, check the preview, then confirm. Marks have their own
          upload on the <Link to="/faculty/marks" className="font-medium text-primary underline-offset-4 hover:underline">Marks</Link> page.
        </p>
      </div>

      <div role="tablist" aria-label="Import type" className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab.id}
            onClick={() => setActive(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              t.id === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {IMPORT_SPECS[t.id].title}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import {spec.title.toLowerCase()}</CardTitle>
          <CardDescription>{tab.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <BulkImport
            key={tab.id}
            spec={spec}
            ctx={ctx}
            endpoint={tab.endpoint}
            note={tab.note}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["import-context"] });
              qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
              qc.invalidateQueries({ queryKey: ["attendance-health"] });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
