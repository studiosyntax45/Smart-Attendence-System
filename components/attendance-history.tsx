import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { exportFilename } from "@/lib/export";
import { ExportMenu } from "@/components/export-menu";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceStatus } from "@/lib/utils";

interface HistoryRow {
  id: string;
  entryTime: string;
  exitTime: string | null;
  status: AttendanceStatus;
  excused: boolean;
  student: { fullName: string; rollNo: string | null; studentDetails: { section: string | null } | null } | null;
  session: { course: string; openedAt: string; faculty: { id: string; fullName: string } | null } | null;
}

const EMPTY = { q: "", courseCode: "", section: "", facultyId: "", from: "", to: "", status: "" };
type Filters = typeof EMPTY;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AttendanceHistory({ showFacultyFilter = false }: { showFacultyFilter?: boolean }) {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);

  const options = useQuery({
    queryKey: ["history-options", showFacultyFilter],
    queryFn: async () => {
      const [courses, faculty] = await Promise.all([
        api.get<{ courses: Array<{ code: string; name: string }> }>("/courses?mine=true"),
        showFacultyFilter
          ? api.get<{ profiles: Array<{ id: string; fullName: string }> }>("/profiles?role=faculty")
          : Promise.resolve({ profiles: [] }),
      ]);
      return { courses: courses.courses, faculty: faculty.profiles };
    },
  });

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["attendance-history", filters],
    queryFn: () => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ""));
      qs.set("limit", "1000");
      return api.get<{ attendance: HistoryRow[] }>(`/attendance?${qs}`);
    },
    placeholderData: (prev) => prev,
  });

  const rows = data?.attendance ?? [];
  const active = Object.values(filters).some((v) => v !== "");
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [k]: e.target.value });

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Attendance records</CardTitle>
            <CardDescription>
              Search individual entries. Sessions a student never joined count as absent in Attendance Health; here
              &quot;Absent&quot; lists records marked absent by a correction.
            </CardDescription>
          </div>
          <ExportMenu
            filename={exportFilename("attendance", [filters.courseCode, filters.section, filters.status, filters.from, filters.to])}
            title="Attendance records"
            subtitle={[
              filters.courseCode && `Course ${filters.courseCode}`,
              filters.section && `Section ${filters.section}`,
              filters.status && `Status ${filters.status}`,
              (filters.from || filters.to) && `${filters.from || "…"} to ${filters.to || "…"}`,
              filters.q && `Search "${filters.q}"`,
            ]
              .filter(Boolean)
              .join(" · ")}
            columns={[
              { key: "date", label: "Date" },
              { key: "student", label: "Student" },
              { key: "usn", label: "USN" },
              { key: "section", label: "Section" },
              { key: "course", label: "Course" },
              { key: "faculty", label: "Faculty" },
              { key: "entry", label: "Entry" },
              { key: "exit", label: "Exit" },
              { key: "status", label: "Status" },
            ]}
            rows={rows.map((r) => ({
              date: new Date(r.session?.openedAt ?? r.entryTime).toLocaleDateString(),
              student: r.student?.fullName ?? "",
              usn: r.student?.rollNo ?? "",
              section: r.student?.studentDetails?.section ?? "",
              course: r.session?.course ?? "",
              faculty: r.session?.faculty?.fullName ?? "",
              entry: r.status === "absent" ? "" : new Date(r.entryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              exit: r.status === "absent" ? "" : r.exitTime ? new Date(r.exitTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
              status: r.excused ? "excused" : r.status,
            }))}
          />
        </div>

        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters(draft);
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="h-q">Student or USN</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="h-q" value={draft.q} onChange={set("q")} placeholder="e.g. Rahul or PES1UG23CS001" className="h-10 pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-course">Course</Label>
            <select id="h-course" value={draft.courseCode} onChange={set("courseCode")} className={selectClass}>
              <option value="">All courses</option>
              {(options.data?.courses ?? []).map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-status">Status</Label>
            <select id="h-status" value={draft.status} onChange={set("status")} className={selectClass}>
              <option value="">Any status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="partial">Partial</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-section">Section</Label>
            <Input id="h-section" value={draft.section} onChange={set("section")} placeholder="e.g. A" className="h-10" />
          </div>
          {showFacultyFilter && (
            <div className="space-y-1.5">
              <Label htmlFor="h-faculty">Faculty</Label>
              <select id="h-faculty" value={draft.facultyId} onChange={set("facultyId")} className={selectClass}>
                <option value="">Any faculty</option>
                {(options.data?.faculty ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.fullName}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="h-from">From</Label>
            <Input id="h-from" type="date" value={draft.from} onChange={set("from")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-to">To</Label>
            <Input id="h-to" type="date" min={draft.from || undefined} value={draft.to} onChange={set("to")} className="h-10" />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={isFetching}>
              <Search className="size-4" aria-hidden="true" />
              {isFetching ? "Searching…" : "Search"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(EMPTY);
                setFilters(EMPTY);
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="py-6 text-center text-sm">
            <p className="text-destructive">Could not load records.</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : !data ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {active ? "No records match these filters. Try widening the date range or clearing a filter." : "No attendance recorded yet."}
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground tabular-nums">
              {rows.length} record{rows.length === 1 ? "" : "s"}{rows.length === 1000 ? " (first 1000 — narrow the filters)" : ""}
            </p>
            <div className={`max-h-[32rem] overflow-auto rounded-md border ${isFetching ? "opacity-60" : ""}`}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pl-3 pr-4 font-medium">Date</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Faculty</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Entry</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/40">
                      <td className="whitespace-nowrap py-2 pl-3 pr-4 font-mono text-xs tabular-nums">
                        {new Date(r.session?.openedAt ?? r.entryTime).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{r.student?.fullName ?? "—"}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {r.student?.rollNo ?? ""}
                          {r.student?.studentDetails?.section ? ` · Sec ${r.student.studentDetails.section}` : ""}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{r.session?.course ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.session?.faculty?.fullName ?? "—"}</td>
                      <td className="py-2 pr-4 font-mono text-xs tabular-nums">
                        {r.status === "absent" ? "—" : new Date(r.entryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusPill status={r.status} excused={r.excused} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
