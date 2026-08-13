
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { listAllClasses, listStudentPool } from "@/lib/classes";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { ClassManager } from "@/components/admin/class-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminClassesPage() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-classes", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [classes, students, coursesRes] = await Promise.all([
        listAllClasses(),
        listStudentPool(),
        api.get<{ courses: { code: string; name: string; semester: string }[] }>("/courses"),
      ]);

      return {
        classes,
        students,
        courses: coursesRes.courses ?? [],
      };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load class sections.")}
        reset={() => refetch()}
      />
    );

  return (
    <div className="space-y-6">
      <PageTitle title="Class Sections" />
      <GsapReveal>
        <Card className="border-border/60 bg-gradient-to-br from-card via-card to-muted/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Class Sections & Roster Management</CardTitle>
                <CardDescription>
                  Organise students into academic class cohorts (e.g. Sem-4 CSE-A) and assign courses with auto-enrollment.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ClassManager
              initialClasses={data.classes}
              availableCourses={data.courses}
              availableStudents={data.students}
              onRefresh={() => refetch()}
            />
          </CardContent>
        </Card>
      </GsapReveal>
    </div>
  );
}
