import { createContext, useCallback, useContext, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { fetchStudentAttendance } from "@/lib/attendance";
import { exportFilename } from "@/lib/export";
import { Dialog } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/export-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/status-pill";
import { LeaveStatusPill } from "@/components/leave-status-pill";
import type { AttendanceStatus } from "@/lib/utils";

export type Cell = string | number | null | undefined;
/** `_studentId` makes a row open that student; add `_courseCode` to open that course instead. */
export type ListRow = Record<string, Cell> & { _studentId?: string; _name?: string; _usn?: string | null; _courseCode?: string };

export type DrillSpec =
  | {
      kind: "list";
      title: string;
      subtitle?: string;
      columns: Array<{ key: string; label: string; numeric?: boolean }>;
      rows: ListRow[];
      empty?: string;
      link?: { to: string; label: string };
    }
  | { kind: "student"; studentId: string; name: string; usn?: string | null }
  | { kind: "course"; studentId: string; courseCode: string; courseName?: string };

type Open = (spec: DrillSpec) => void;
const Ctx = createContext<{ open: Open; push: Open } | null>(null);

/** Opens the shared drill-down popup. Outside the app shell it does nothing. */
export function useDrillDown() {
  return useContext(Ctx) ?? { open: () => undefined, push: () => undefined };
}

/** Keyboard + mouse props that make a table row or card open a drill-down. */
export function clickable(onOpen: () => void, className = "") {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
    className: `cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${className}`,
  };
}

export function DrillDownProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<DrillSpec[]>([]);
  const open = useCallback<Open>((spec) => setStack([spec]), []);
  const push = useCallback<Open>((spec) => setStack((s) => [...s, spec]), []);
  const value = useMemo(() => ({ open, push }), [open, push]);
  const spec = stack.at(-1);
  const close = () => setStack([]);
  const back = stack.length > 1 ? () => setStack((s) => s.slice(0, -1)) : undefined;

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog
        open={!!spec}
        onClose={close}
        title={
          <span className="flex items-center gap-2">
            {back && (
              <button type="button" onClick={back} aria-label="Back" className="rounded p-1 hover:bg-muted">
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
            )}
            {spec ? titleOf(spec) : ""}
          </span>
        }
        subtitle={spec?.kind === "list" ? spec.subtitle : spec?.kind === "student" ? spec.usn ?? undefined : spec?.courseCode}
        actions={spec?.kind === "list" && spec.rows.length > 0 ? <ListExport spec={spec} /> : undefined}
        footer={
          spec?.kind === "list" && spec.link ? (
            <Link to={spec.link.to} onClick={close} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {spec.link.label}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : undefined
        }
      >
        {spec?.kind === "list" && <ListPanel spec={spec} onStudent={push} />}
        {spec?.kind === "student" && <StudentPanel spec={spec} onCourse={push} />}
        {spec?.kind === "course" && <CoursePanel spec={spec} />}
      </Dialog>
    </Ctx.Provider>
  );
}

function titleOf(spec: DrillSpec): string {
  if (spec.kind === "list") return `${spec.title} (${spec.rows.length})`;
  if (spec.kind === "student") return spec.name;
  return spec.courseName ? `${spec.courseName}` : spec.courseCode;
}

function ListExport({ spec }: { spec: Extract<DrillSpec, { kind: "list" }> }) {
  return <ExportMenu filename={exportFilename(spec.title.toLowerCase().replace(/\s+/g, "_"), [])} title={spec.title} subtitle={spec.subtitle} columns={spec.columns} rows={spec.rows} />;
}

const th = "py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
const td = "py-2.5 pr-4";

function ListPanel({ spec, onStudent }: { spec: Extract<DrillSpec, { kind: "list" }>; onStudent: Open }) {
  if (spec.rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{spec.empty ?? "Nothing to show."}</p>;
  return (
    <table className="w-full text-sm">
      <thead className="sticky -top-4 bg-card">
        <tr className="border-b">
          {spec.columns.map((c) => (
            <th key={c.key} scope="col" className={`${th} ${c.numeric ? "text-right" : ""}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {spec.rows.map((row, i) => {
          const open = row._studentId
            ? clickable(() =>
                onStudent(
                  row._courseCode
                    ? { kind: "course", studentId: row._studentId!, courseCode: row._courseCode, courseName: row._name }
                    : { kind: "student", studentId: row._studentId!, name: row._name ?? String(row[spec.columns[0].key] ?? ""), usn: row._usn }
                )
              )
            : null;
          return (
            <tr key={i} {...(open ?? {})} className={`border-b last:border-0 ${open ? `${open.className} hover:bg-muted/50` : ""}`}>
              {spec.columns.map((c) => (
                <td key={c.key} className={`${td} ${c.numeric ? "text-right font-mono text-xs tabular-nums" : ""}`}>
                  {row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Loading() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-2/3" />
    </div>
  );
}

function StudentPanel({ spec, onCourse }: { spec: Extract<DrillSpec, { kind: "student" }>; onCourse: Open }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["drill-student", spec.studentId],
    queryFn: async () => {
      const [summary, marks, leave] = await Promise.all([
        fetchStudentAttendance(spec.studentId),
        api.get<{ marks: Array<{ id: string; course: string; assessment: string; score: number; maxScore: number }> }>(`/marks?studentId=${spec.studentId}`),
        api
          .get<{ leaveApplications: Array<{ id: string; studentId: string; leaveType: string; fromDate: string; toDate: string; status: "pending" | "approved" | "rejected" | "withdrawn" }> }>("/leave-applications")
          .catch(() => ({ leaveApplications: [] })),
      ]);
      return { summary: summary.filter((r) => r.conducted > 0), marks: marks.marks, leave: leave.leaveApplications.filter((l) => l.studentId === spec.studentId) };
    },
  });
  if (isLoading) return <Loading />;
  if (isError || !data) return <p className="text-sm text-destructive">Could not load this student.</p>;

  const held = data.summary.reduce((n, r) => n + r.conducted, 0);
  const attended = data.summary.reduce((n, r) => n + r.present_cnt + r.late_cnt + r.partial_cnt, 0);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        Overall attendance{" "}
        <span className="font-semibold tabular-nums">{held ? `${Math.round((100 * attended) / held)}%` : "—"}</span>
        <span className="text-muted-foreground"> · {attended} of {held} classes (excused sessions not counted)</span>
      </p>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Attendance by course</h3>
        {data.summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closed sessions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className={th}>Course</th>
                <th className={`${th} text-right`}>Attended</th>
                <th className={`${th} text-right`}>Late</th>
                <th className={`${th} text-right`}>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map((r) => {
                const open = clickable(() => onCourse({ kind: "course", studentId: spec.studentId, courseCode: r.course_code, courseName: r.course_name }));
                return (
                  <tr key={r.course_code} {...open} className={`${open.className} border-b last:border-0 hover:bg-muted/50`}>
                    <td className={td}>
                      {r.course_name}
                      <span className="ml-1 font-mono text-xs text-muted-foreground">{r.course_code}</span>
                    </td>
                    <td className={`${td} text-right font-mono text-xs tabular-nums`}>
                      {r.present_cnt + r.late_cnt + r.partial_cnt}/{r.conducted}
                    </td>
                    <td className={`${td} text-right font-mono text-xs tabular-nums`}>{r.late_cnt}</td>
                    <td className={`${td} text-right font-mono text-xs tabular-nums ${(r.official_pct ?? 0) < 75 ? "text-status-absent" : ""}`}>
                      {r.official_pct === null ? "—" : `${Math.round(r.official_pct)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Marks</h3>
        {data.marks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No marks recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className={th}>Course</th>
                <th className={th}>Assessment</th>
                <th className={`${th} text-right`}>Score</th>
              </tr>
            </thead>
            <tbody>
              {data.marks.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className={`${td} font-mono text-xs`}>{m.course}</td>
                  <td className={td}>{m.assessment}</td>
                  <td className={`${td} text-right font-mono text-xs tabular-nums`}>
                    {Number(m.score)}/{Number(m.maxScore)}
                    <span className="ml-1 text-muted-foreground">({Math.round((100 * Number(m.score)) / Number(m.maxScore))}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Leave requests</h3>
        {data.leave.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.leave.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="capitalize">{l.leaveType}</span>
                  <span className="ml-2 text-muted-foreground tabular-nums">
                    {l.fromDate.slice(0, 10)} → {l.toDate.slice(0, 10)}
                  </span>
                </span>
                <LeaveStatusPill status={l.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CoursePanel({ spec }: { spec: Extract<DrillSpec, { kind: "course" }> }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["drill-course", spec.studentId, spec.courseCode],
    queryFn: async () => {
      const [att, sessions, enr] = await Promise.all([
        api.get<{ attendance: Array<{ sessionId: string; status: AttendanceStatus; excused: boolean; entryTime: string; exitTime: string | null }> }>(
          `/attendance?studentId=${spec.studentId}&courseCode=${encodeURIComponent(spec.courseCode)}`
        ),
        api.get<{ sessions: Array<{ id: string; course: string; openedAt: string; closedAt: string | null }> }>("/sessions"),
        api.get<{ enrollments: Array<{ courseCode: string; enrolledAt: string }> }>(`/enrollments?studentId=${spec.studentId}`),
      ]);
      // Same rule as the attendance summary: closed sessions of this course held after enrolment.
      const since = enr.enrollments.find((e) => e.courseCode === spec.courseCode)?.enrolledAt ?? "";
      const byId = new Map(att.attendance.map((a) => [a.sessionId, a]));
      return sessions.sessions
        .filter((s) => s.course === spec.courseCode && s.closedAt && s.openedAt >= since)
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
        .map((s) => ({ session: s, record: byId.get(s.id) ?? null }));
    },
  });
  if (isLoading) return <Loading />;
  if (isError || !data) return <p className="text-sm text-destructive">Could not load this course.</p>;
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No closed sessions in this course yet.</p>;

  const time = (t: string) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <table className="w-full text-sm">
      <thead className="sticky -top-4 bg-card">
        <tr className="border-b">
          <th className={th}>Date</th>
          <th className={th}>Entry</th>
          <th className={th}>Exit</th>
          <th className={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.map(({ session, record }) => {
          const present = record && record.status !== "absent";
          return (
            <tr key={session.id} className="border-b last:border-0">
              <td className={`${td} tabular-nums`}>
                {new Date(session.openedAt).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" })}
              </td>
              <td className={`${td} font-mono text-xs tabular-nums`}>{present ? time(record.entryTime) : "—"}</td>
              <td className={`${td} font-mono text-xs tabular-nums`}>{present && record.exitTime ? time(record.exitTime) : "—"}</td>
              <td className={td}>
                <StatusPill status={record?.status ?? "absent"} excused={record?.excused ?? false} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
