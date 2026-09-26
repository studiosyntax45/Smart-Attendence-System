import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listStudents, type StudentListRow } from "@/lib/student-details";
import { StudentDetailsForm } from "@/components/faculty/student-details-form";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function matches(s: StudentListRow, q: string): boolean {
  return [s.fullName, s.rollNo, s.email, s.branch, s.section].some((v) => v?.toLowerCase().includes(q));
}

export default function StudentsPage() {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StudentListRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data, isPending: isLoading, isError, refetch } = useQuery({
    queryKey: ["students-directory"],
    enabled: !!profile,
    queryFn: listStudents,
  });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? (data ?? []).filter((s) => matches(s, q)) : data ?? [];
  }, [data, query]);

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data) return <SectionError error={new Error("Could not load students.")} reset={() => refetch()} />;

  const missing = data.filter((s) => !s.personalFilled).length;

  return (
    <div className="space-y-6">
      <PageTitle title="Students" />
      <div>
        <h1 className="text-2xl font-bold">Students</h1>
        <p className="text-sm text-muted-foreground">
          Add or correct a student&apos;s profile details. Students see them on their Profile page. New students are added
          through Bulk Import.
        </p>
      </div>

      {message && (
        <p role="status" className="rounded-md border bg-card px-4 py-2 text-sm">
          {message}
        </p>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>All students</CardTitle>
            <CardDescription>
              {data.length} students{missing > 0 && ` · ${missing} without personal details`}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Search students"
              placeholder="Search name, USN, email, branch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">USN</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Email</th>
                <th className="px-4 py-2 font-medium">Class</th>
                <th className="px-4 py-2 font-medium">Details</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{s.fullName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.rollNo ?? "—"}</td>
                  <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">{s.email ?? "—"}</td>
                  <td className="px-4 py-2">
                    {[s.branch, s.section && `Sec ${s.section}`, s.year && `Year ${s.year}`].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-2">
                    {s.personalFilled ? <Badge variant="outline">Filled</Badge> : <Badge variant="secondary">Missing</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMessage(null);
                        setEditing(s);
                      }}
                      aria-label={`Edit details for ${s.fullName}`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {data.length === 0 ? "No students yet. Add them through Bulk Import." : "No students match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit details: ${editing.fullName}` : ""}
        subtitle={editing?.rollNo ?? undefined}
      >
        {editing && (
          <StudentDetailsForm
            studentId={editing.id}
            onSaved={(msg) => {
              setMessage(`${editing.fullName}: ${msg}`);
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
