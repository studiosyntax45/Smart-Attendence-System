import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { buildImportPreview, type ImportContext, type ImportSpec } from "@/lib/bulk-import";
import { downloadCsv, rowsToCsv } from "@/lib/export";
import { Button } from "@/components/ui/button";

export interface ServerImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; key: string; field: string; error: string }>;
}

export function BulkImport({
  spec,
  ctx,
  endpoint,
  onDone,
  note,
}: {
  spec: ImportSpec;
  ctx: ImportContext;
  endpoint: string;
  onDone?: () => void;
  note?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "errors">("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ServerImportSummary | null>(null);

  const preview = useMemo(() => (text === null ? null : buildImportPreview(text, spec, ctx)), [text, spec, ctx]);

  function reset() {
    setText(null);
    setFileName(null);
    setError(null);
    setView("all");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setSummary(null);
    if (!/\.csv$/i.test(file.name)) {
      setError("Only .csv files are supported. In Excel use File → Save As → CSV (UTF-8).");
      return;
    }
    setFileName(file.name);
    setText(await file.text());
  }

  async function handleImport() {
    if (!preview || preview.payload.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ summary: ServerImportSummary }>(endpoint, { rows: preview.payload });
      setSummary(res.summary);
      reset();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSaving(false);
    }
  }

  const shown = preview ? (view === "errors" ? preview.rows.filter((r) => r.errors.length > 0) : preview.rows) : [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Columns</p>
        <ul className="flex flex-wrap gap-1.5">
          {spec.columns.map((c) => (
            <li
              key={c.key}
              className="rounded-md border px-2 py-1 font-mono text-xs"
              title={c.hint}
            >
              {c.label}
              {c.required ? <span className="text-destructive"> *</span> : <span className="text-muted-foreground"> (optional)</span>}
              {c.hint && <span className="ml-1 font-sans text-muted-foreground">— {c.hint}</span>}
            </li>
          ))}
        </ul>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => downloadCsv(spec.templateName, rowsToCsv(spec.sample))}
        >
          <Download className="size-4" aria-hidden="true" />
          Download template
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label={`Choose ${spec.title} CSV file`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button type="button" variant="accent" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" aria-hidden="true" />
          Choose CSV
        </Button>
        {fileName && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            {fileName}
            <button type="button" onClick={reset} aria-label="Remove file" className="rounded p-0.5 hover:bg-muted">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>

      {(error || preview?.error) && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error ?? preview?.error}
        </p>
      )}

      {summary && <SummaryPanel summary={summary} />}

      {preview && !preview.error && preview.rows.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          The file has a header row but no data rows.
        </p>
      )}

      {preview && preview.rows.length > 0 && (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Total rows" value={preview.rows.length} />
            <Stat label="Valid" value={preview.validCount} tone="good" icon={<CheckCircle2 className="size-3.5" aria-hidden="true" />} />
            <Stat label="Warnings" value={preview.warningCount} tone="warn" icon={<AlertTriangle className="size-3.5" aria-hidden="true" />} />
            <Stat label="Errors" value={preview.errorCount} tone="bad" icon={<XCircle className="size-3.5" aria-hidden="true" />} />
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-md border p-0.5 text-sm" role="tablist" aria-label="Preview filter">
              {(["all", "errors"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`rounded px-2.5 py-1 ${view === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "all" ? "All rows" : `Errors (${preview.errorCount})`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleImport} disabled={saving || preview.validCount === 0}>
                {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                {saving ? "Importing…" : `Import ${preview.validCount} record${preview.validCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
          {preview.errorCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Rows with errors are not imported. Fix them in the CSV and upload it again.
            </p>
          )}

          <div className="max-h-96 overflow-auto rounded-md border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="sticky top-0 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pl-3 pr-3 font-medium">Row</th>
                  {spec.columns.map((c) => (
                    <th key={c.key} scope="col" className="py-2 pr-3 font-medium">{c.label}</th>
                  ))}
                  <th scope="col" className="min-w-[16rem] py-2 pr-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const bad = r.errors.length > 0;
                  const badFields = new Set(r.errors.map((e) => e.field));
                  return (
                    <tr key={r.line} className={`border-t align-top ${bad ? "bg-destructive/5" : ""}`}>
                      <td className="py-2 pl-3 pr-3 font-mono text-xs tabular-nums text-muted-foreground">{r.line}</td>
                      {spec.columns.map((c) => (
                        <td
                          key={c.key}
                          className={`py-2 pr-3 text-xs ${badFields.has(c.key) ? "font-medium text-destructive" : ""}`}
                        >
                          {r.values[c.key] || <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                      <td className="py-2 pr-3 text-xs">
                        {bad ? (
                          <span className="text-destructive">{r.errors.map((e) => e.error).join(" ")}</span>
                        ) : r.warnings.length ? (
                          <span className="text-status-late">{r.warnings.join(" ")}</span>
                        ) : (
                          <span className="text-status-present">Ready</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn" | "bad";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "good" ? "text-status-present" : tone === "warn" ? "text-status-late" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-md border px-3 py-2">
      <dt className={`flex items-center gap-1 text-xs text-muted-foreground`}>
        <span className={color}>{icon}</span>
        {label}
      </dt>
      <dd className={`text-xl font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

function SummaryPanel({ summary }: { summary: ServerImportSummary }) {
  return (
    <div role="status" className="space-y-3 rounded-md border bg-status-present/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-status-present">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Import finished
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Created" value={summary.created} tone="good" />
        <Stat label="Updated" value={summary.updated} />
        <Stat label="Skipped" value={summary.skipped} tone="warn" />
        <Stat label="Errors" value={summary.errors.length} tone="bad" />
      </dl>
      {summary.errors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Row</th>
                <th className="py-1 pr-3 font-medium">Key</th>
                <th className="py-1 pr-3 font-medium">Field</th>
                <th className="py-1 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {summary.errors.map((e, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 pr-3 font-mono tabular-nums">{e.row}</td>
                  <td className="py-1 pr-3 font-mono">{e.key || "—"}</td>
                  <td className="py-1 pr-3">{e.field}</td>
                  <td className="py-1 text-destructive">{e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
