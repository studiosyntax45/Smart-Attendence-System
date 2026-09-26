import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, FileSpreadsheet } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { MarksForm, type StudentOption } from "@/components/faculty/marks-form";
import { BulkMarksUpload } from "@/components/faculty/bulk-marks-upload";
import { ExportMenu } from "@/components/export-menu";
import { exportFilename } from "@/lib/export";
import { clickable, useDrillDown } from "@/components/drilldown";

export interface MarkRow {
  id: string;
  student_id: string;
  updated_at: string;
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
  const { open } = useDrillDown();
  const [exportCourse, setExportCourse] = useState("");

  const { data, isPending: isLoading, isError, refetch } = useQuery({
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

      const courses = coursesRes.courses ?? [];

      const marks: MarkRow[] = (marksRes.marks ?? []).map((m) => ({
        id: m.id,
        student_id: m.studentId,
        course: m.course,
        assessment: m.assessment,
        score: m.score,
        max_score: m.maxScore,
        updated_at: m.updatedAt ?? new Date().toISOString(),
        profiles: studentMap.get(m.studentId) ?? null,
      }));

      marks.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return { students, courses, marks: marks.slice(0, 30), allMarks: marks };
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

  const { students, courses, marks, allMarks } = data;

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="Upload Marks" />
      <div>
        <h1 className="text-2xl font-bold">Upload Marks</h1>
        <p className="text-sm text-muted-foreground">
          Upload a whole class from a CSV file, or record a single score below.
          Students see their own marks on their dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden="true" />
            Bulk upload from CSV
          </CardTitle>
          <CardDescription>
            Columns: USN, Student Name, Marks. Every row is saved against the course and
            assessment you pick here. You see a preview before anything is saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No students registered yet.
            </p>
          ) : (
            <BulkMarksUpload
              students={students}
              courses={courses}
              existingMarks={allMarks.map((m) => ({
                studentId: m.student_id,
                course: m.course,
                assessment: m.assessment,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record a single score</CardTitle>
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
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                Recently recorded
              </CardTitle>
              <CardDescription>Latest 30 entries, newest first.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Course to export"
                value={exportCourse}
                onChange={(e) => setExportCourse(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="">All courses</option>
                {courses.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              <ExportMenu
                filename={exportFilename("marks", [exportCourse])}
                title={`Marks${exportCourse ? ` — ${exportCourse}` : ""}`}
                columns={[
                  { key: "usn", label: "USN" },
                  { key: "name", label: "Student" },
                  { key: "course", label: "Course" },
                  { key: "assessment", label: "Assessment" },
                  { key: "score", label: "Score" },
                  { key: "max", label: "Out of" },
                ]}
                rows={allMarks
                  .filter((m) => !exportCourse || m.course === exportCourse)
                  .map((m) => ({
                    usn: m.profiles?.roll_no ?? "",
                    name: m.profiles?.full_name ?? "",
                    course: m.course,
                    assessment: m.assessment,
                    score: Number(m.score),
                    max: Number(m.max_score),
                  }))}
              />
            </div>
          </CardHeader>
          <CardContent>
            {!marks || marks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No marks recorded yet — they&apos;ll appear here as you save
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
                      <tr
                        key={m.id}
                        {...clickable(
                          () => open({ kind: "student", studentId: m.student_id, name: m.profiles?.full_name ?? "Student", usn: m.profiles?.roll_no }),
                          "border-b transition-colors last:border-0 hover:bg-muted/50"
                        )}
                      >
                        <td className="py-2.5 pr-4 font-medium">
                          {m.profiles?.full_name ?? "—"}
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
