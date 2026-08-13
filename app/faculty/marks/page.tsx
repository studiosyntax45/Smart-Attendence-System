
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Layers } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { MarksForm, type StudentOption } from "@/components/faculty/marks-form";

export interface MarkRow {
  id: string;
  course: string;
  assessment: string;
  score: number;
  max_score: number;
  profiles: { full_name: string; roll_no: string | null } | null;
}
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MarksPage() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-marks", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [studentsRes, coursesRes, marksRes] = await Promise.all([
        api.get<{ profiles: Array<{ id: string; fullName: string; rollNo: string | null }> }>("/profiles?role=student"),
        api.get<{ courses: Array<{ code: string; name: string }> }>("/courses"),
        api.get<{ marks: Array<{ id: string; studentId: string; course: string; assessment: string; score: number; maxScore: number; updatedAt?: string }> }>("/marks"),
      ]);

      const students: StudentOption[] = (studentsRes.profiles ?? []).map((s) => ({
        id: s.id,
        full_name: s.fullName,
        roll_no: s.rollNo,
      }));

      const studentMap = new Map<string, { full_name: string; roll_no: string | null }>();
      for (const s of students) {
        studentMap.set(s.id, { full_name: s.full_name, roll_no: s.roll_no });
      }

      const courses = (coursesRes.courses ?? []).map((c) => c.code);

      const marks: MarkRow[] = (marksRes.marks ?? []).map((m) => ({
        id: m.id,
        course: m.course,
        assessment: m.assessment,
        score: m.score,
        max_score: m.maxScore,
        updated_at: m.updatedAt ?? new Date().toISOString(),
        profiles: studentMap.get(m.studentId) ?? null,
      }));

      return { students, courses, marks };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load marks.")}
        reset={() => refetch()}
      />
    );

  const { students, courses, marks } = data;

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Upload Marks" />
      <div>
        <h1 className="text-2xl font-bold">Upload Marks</h1>
        <p className="text-sm text-muted-foreground">
          Only faculty and admins can record scores Ã¢â‚¬â€ students see their own
          marks on their dashboard.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record a score</CardTitle>
            <CardDescription>
              Saving the same student + course + assessment again updates the
              existing score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students && students.length > 0 ? (
              <MarksForm students={students} courses={courses} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No students registered yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              Recently recorded
            </CardTitle>
            <CardDescription>Latest 30 entries, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {!marks || marks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No marks recorded yet Ã¢â‚¬â€ they&apos;ll appear here as you save
                them.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Assessment</th>
                      <th scope="col" className="py-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((m) => (
                      <tr key={m.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                        <td className="py-2.5 pr-4 font-medium">
                          {m.profiles?.full_name ?? "Ã¢â‚¬â€"}
                          {m.profiles?.roll_no && (
                            <span className="ml-1 font-mono text-xs text-muted-foreground">
                              {m.profiles.roll_no}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">{m.course}</td>
                        <td className="py-2.5 pr-4">{m.assessment}</td>
                        <td className="py-2.5 font-mono text-xs">
                          {Number(m.score)}/{Number(m.max_score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GsapReveal>
  );
}
