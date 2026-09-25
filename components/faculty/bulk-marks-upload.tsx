import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import { bulkUploadMarks } from "@/app/faculty/marks/actions";
import { buildMarksPreview, type ImportStudent, type MarksPreviewRow } from "@/lib/marks-import";
import { downloadCsv, toCsv } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ExistingMark {
  studentId: string;
  course: string;
  assessment: string;
}

const selectClass =
  "flex h-11 w-full cursor-pointer rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_STYLE: Record<MarksPreviewRow["status"], string> = {
  ready: "bg-status-present/10 text-status-present",
  update: "bg-status-late/10 text-status-late",
  error: "bg-destructive/10 text-destructive",
};
const STATUS_LABEL: Record<MarksPreviewRow["status"], string> = {
  ready: "New",
  update: "Overwrite",
  error: "Skipped",
};

export function BulkMarksUpload({
  students,
  courses,
  existingMarks,
}: {
  students: ImportStudent[];
  courses: Array<{ code: string; name: string }>;
  existingMarks: ExistingMark[];
}) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [course, setCourse] = useState("");
  const [assessment, setAssessment] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saved: number; skipped: Array<{ usn: string; reason: string }> } | null>(null);

  const preview = useMemo(() => {
    if (!csvText) return null;
    const alreadyMarked = new Set(
      existingMarks
        .filter((m) => m.course === course && m.assessment === assessment.trim())
        .map((m) => m.studentId)
    );
    return buildMarksPreview(csvText, { students, maxScore, alreadyMarked });
  }, [csvText, students, maxScore, course, assessment, existingMarks]);

  const validRows = preview?.rows.filter((r) => r.status !== "error") ?? [];
  const errorCount = (preview?.rows.length ?? 0) - validRows.length;

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    if (!/\.csv$/i.test(file.name)) {
      setError("Only .csv files are supported. In Excel, use File → Save As → CSV.");
      return;
    }
    setFileName(file.name);
    setCsvText(await file.text());
  }

  function clearFile() {
    setCsvText(null);
    setFileName(null);
    setResult(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function downloadTemplate() {
    downloadCsv(
      `marks_template_${course || "course"}.csv`,
      toCsv(
        [
          { key: "usn", label: "USN" },
          { key: "name", label: "Student Name" },
          { key: "marks", label: "Marks" },
        ],
        students
          .filter((s) => s.roll_no)
          .map((s) => ({ usn: s.roll_no, name: s.full_name, marks: "" }))
      )
    );
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const res = await bulkUploadMarks({
      course,
      assessment,
      maxScore,
      rows: validRows.map((r) => ({ usn: r.usn, score: r.score! })),
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult({ saved: res.saved ?? 0, skipped: res.skipped ?? [] });
    setCsvText(null);
    setFileName(null);
    if (fileInput.current) fileInput.current.value = "";
    qc.invalidateQueries({ queryKey: ["faculty-marks"] });
    qc.invalidateQueries({ queryKey: ["faculty-performance"] });
    qc.invalidateQueries({ queryKey: ["student-dashboard"] });
  }

  const ready = course !== "" && assessment.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="bulk-course">Course</Label>
          <select
            id="bulk-course"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            suppressHydrationWarning
            className={selectClass}
          >
            <option value="" disabled>
              Choose a course…
            </option>
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-assessment">Assessment</Label>
          <Input
            id="bulk-assessment"
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            placeholder="e.g. ISA-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-max">Out of</Label>
          <Input
            id="bulk-max"
            type="number"
            min={1}
            step="0.5"
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          id="bulk-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="accent"
          disabled={!ready}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" aria-hidden="true" />
          Choose CSV file
        </Button>
        <Button type="button" variant="outline" onClick={downloadTemplate}>
          <Download className="size-4" aria-hidden="true" />
          Download template
        </Button>
        {fileName && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            {fileName}
            <button
              type="button"
              onClick={clearFile}
              aria-label="Remove file"
              className="rounded p-0.5 hover:bg-muted"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
      {!ready && (
        <p className="text-xs text-muted-foreground">
          Pick the course and assessment first — every row in the file is saved against them.
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {preview?.error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {preview.error}
        </p>
      )}

      {result && (
        <div role="status" className="space-y-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Saved {result.saved} mark{result.saved === 1 ? "" : "s"}.
          </p>
          {result.skipped.length > 0 && (
            <ul className="list-disc pl-8 text-destructive">
              {result.skipped.map((s) => (
                <li key={s.usn}>
                  {s.usn} — {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preview && !preview.error && preview.rows.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          The file has a header row but no student rows.
        </p>
      )}

      {preview && preview.rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {validRows.length} row{validRows.length === 1 ? "" : "s"} will be saved
              {errorCount > 0 && `, ${errorCount} skipped`}. Nothing is saved until you confirm.
            </p>
            <Button type="button" disabled={saving || validRows.length === 0} onClick={handleConfirm}>
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {saving ? "Saving…" : `Confirm and save ${validRows.length}`}
            </Button>
          </div>

          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pl-3 pr-4 font-medium">Line</th>
                  <th scope="col" className="py-2 pr-4 font-medium">USN</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Marks</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr
                    key={r.line}
                    className={`border-b last:border-0 ${r.status === "error" ? "bg-destructive/5" : ""}`}
                  >
                    <td className="py-2 pl-3 pr-4 font-mono text-xs tabular-nums text-muted-foreground">{r.line}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.usn || "—"}</td>
                    <td className="py-2 pr-4">{r.studentName ?? r.name ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs tabular-nums">
                      {r.score === null ? "—" : `${r.score}/${maxScore}`}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                      {(r.message || r.warning) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {r.message ?? r.warning}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
