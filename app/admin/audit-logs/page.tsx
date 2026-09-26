import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api-client";
import { exportFilename } from "@/lib/export";
import { ExportMenu } from "@/components/export-menu";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuditRow {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor: { fullName: string; rollNo: string | null } | null;
}

const EMPTY = { from: "", to: "", actorId: "", role: "", action: "", entity: "" };
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const pretty = (s: string) => s.replace(/_/g, " ");

export default function AuditLogsPage() {
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [open, setOpen] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["audit-users"],
    queryFn: () => api.get<{ profiles: Array<{ id: string; fullName: string; role: string }> }>("/profiles"),
  });

  const { data, isPending: isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ""));
      return api.get<{ logs: AuditRow[]; actions: string[]; entities: string[] }>(`/audit-logs?${qs}`);
    },
    placeholderData: (prev) => prev,
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return <SectionError error={new Error("Could not load audit logs.")} reset={() => refetch()} />;

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [k]: e.target.value });
  const active = Object.values(filters).some((v) => v !== "");

  return (
    <div className="space-y-6">
      <PageTitle title="Audit logs" />
      <div>
        <h1 className="text-2xl font-bold">Audit logs</h1>
        <p className="text-sm text-muted-foreground">
          Who changed what: sessions, attendance, leave, marks, imports, users and courses.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters(draft);
            }}
          >
            <Field id="f-from" label="From">
              <Input id="f-from" type="date" value={draft.from} onChange={set("from")} className="h-10" />
            </Field>
            <Field id="f-to" label="To">
              <Input id="f-to" type="date" value={draft.to} onChange={set("to")} className="h-10" />
            </Field>
            <Field id="f-user" label="User">
              <select id="f-user" value={draft.actorId} onChange={set("actorId")} className={selectClass}>
                <option value="">Anyone</option>
                {(users.data?.profiles ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </Field>
            <Field id="f-role" label="Role">
              <select id="f-role" value={draft.role} onChange={set("role")} className={selectClass}>
                <option value="">Any role</option>
                {["admin", "faculty", "student", "system"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field id="f-action" label="Action">
              <select id="f-action" value={draft.action} onChange={set("action")} className={selectClass}>
                <option value="">Any action</option>
                {data.actions.map((a) => (
                  <option key={a} value={a}>{pretty(a)}</option>
                ))}
              </select>
            </Field>
            <Field id="f-entity" label="Entity">
              <select id="f-entity" value={draft.entity} onChange={set("entity")} className={selectClass}>
                <option value="">Any entity</option>
                {data.entities.map((a) => (
                  <option key={a} value={a}>{pretty(a)}</option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
              <Button type="submit" disabled={isFetching}>Apply filters</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(EMPTY);
                  setFilters(EMPTY);
                }}
                disabled={!active && Object.values(draft).every((v) => v === "")}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Activity</CardTitle>
            <CardDescription>
              {data.logs.length} entr{data.logs.length === 1 ? "y" : "ies"}, newest first{data.logs.length === 100 ? " (latest 100)" : ""}.
            </CardDescription>
          </div>
          <ExportMenu
            filename={exportFilename("audit_logs", [filters.action, filters.entity, filters.from, filters.to])}
            title="Audit logs"
            columns={[
              { key: "when", label: "When" },
              { key: "who", label: "Who" },
              { key: "role", label: "Role" },
              { key: "action", label: "Action" },
              { key: "entity", label: "Entity" },
              { key: "summary", label: "Summary" },
            ]}
            rows={data.logs.map((l) => ({
              when: new Date(l.createdAt).toLocaleString(),
              who: l.actor?.fullName ?? "System",
              role: l.actorRole,
              action: pretty(l.action),
              entity: pretty(l.entity),
              summary: l.summary,
            }))}
          />
        </CardHeader>
        <CardContent>
          {data.logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {active ? "Nothing matches these filters." : "No activity recorded yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">When</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Who</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Action</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Summary</th>
                    <th scope="col" className="py-2 font-medium"><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((l) => {
                    const hasDetail = l.before != null || l.after != null;
                    return (
                      <Fragment key={l.id}>
                        <tr className="border-b align-top last:border-0">
                          <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                            {new Date(l.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="font-medium">{l.actor?.fullName ?? "System"}</span>
                            <span className="block text-xs text-muted-foreground">{l.actorRole}</span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{pretty(l.action)}</span>
                            <span className="block pt-1 text-xs text-muted-foreground">{pretty(l.entity)}</span>
                          </td>
                          <td className="py-2.5 pr-4">{l.summary}</td>
                          <td className="py-2.5">
                            {hasDetail && (
                              <button
                                type="button"
                                onClick={() => setOpen(open === l.id ? null : l.id)}
                                aria-expanded={open === l.id}
                                aria-label="Show previous and new values"
                                className="rounded p-1 hover:bg-muted"
                              >
                                <ChevronDown className={`size-4 transition-transform ${open === l.id ? "rotate-180" : ""}`} aria-hidden="true" />
                              </button>
                            )}
                          </td>
                        </tr>
                        {open === l.id && (
                          <tr className="border-b bg-muted/30">
                            <td colSpan={5} className="p-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Values label="Previous value" value={l.before} />
                                <Values label="New value" value={l.after} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Values({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="overflow-x-auto rounded border bg-card p-2 font-mono text-xs">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
