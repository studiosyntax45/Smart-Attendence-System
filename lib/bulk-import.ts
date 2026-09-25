import { norm, parseCsv } from "./csv.ts";

export interface ImportContext {
  /** Lookups are pre-normalised: USNs via norm(), course codes upper-case, the rest lower-case. */
  knownUsns: Set<string>;
  knownCourses: Set<string>;
  knownFaculty?: Set<string>;
  knownRooms?: Set<string>;
  knownClasses?: Set<string>;
  knownEmails?: Map<string, string>;
}

export interface ColumnSpec {
  key: string;
  label: string;
  aliases: string[];
  required: boolean;
  hint?: string;
  /** Canonical form used for checks and sent to the server, e.g. "9:00" -> "09:00". */
  normalize?: (value: string) => string;
  check?: (value: string, ctx: ImportContext) => string | undefined;
}

export interface ImportSpec {
  id: string;
  title: string;
  templateName: string;
  columns: ColumnSpec[];
  sample: string[][];
  keyColumn: string;
  dedupKey?: (values: Record<string, string>) => string;
  /** Cross-column check, run once every column passed (e.g. end after start). */
  rowCheck?: (values: Record<string, string>, ctx: ImportContext) => CellIssue | undefined;
  duplicateMessage?: string;
  /** Row-level warnings (never block the import). */
  warn?: (values: Record<string, string>, ctx: ImportContext) => string[];
}

export interface CellIssue {
  field: string;
  error: string;
}

export interface ImportPreviewRow {
  line: number;
  key: string;
  values: Record<string, string>;
  errors: CellIssue[];
  warnings: string[];
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  error?: string;
  validCount: number;
  warningCount: number;
  errorCount: number;
  payload: Record<string, string>[];
}


export function buildImportPreview(text: string, spec: ImportSpec, ctx: ImportContext): ImportPreview {
  const empty = (error?: string): ImportPreview => ({
    rows: [],
    error,
    validCount: 0,
    warningCount: 0,
    errorCount: 0,
    payload: [],
  });

  const [header, ...data] = parseCsv(text);
  if (!header) return empty("The file is empty.");

  const cols = header.map(norm);
  const index = new Map<string, number>();
  for (const c of spec.columns) {
    const i = cols.findIndex((h) => c.aliases.includes(h));
    if (i >= 0) index.set(c.key, i);
  }
  const missing = spec.columns.filter((c) => c.required && !index.has(c.key)).map((c) => c.label);
  if (missing.length > 0) {
    return empty(
      `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Found: ${header.join(", ")}. Download the template for the expected format.`
    );
  }

  const seen = new Set<string>();
  const rows = data.map((r, i): ImportPreviewRow => {
    const values: Record<string, string> = {};
    for (const c of spec.columns) {
      const at = index.get(c.key);
      const raw = at === undefined ? "" : (r[at] ?? "").trim();
      values[c.key] = raw && c.normalize ? c.normalize(raw) : raw;
    }
    const errors: CellIssue[] = [];
    for (const c of spec.columns) {
      const v = values[c.key];
      if (c.required && v === "") {
        errors.push({ field: c.key, error: `${c.label} is required.` });
        continue;
      }
      if (v !== "" && c.check) {
        const msg = c.check(v, ctx);
        if (msg) errors.push({ field: c.key, error: msg });
      }
    }
    const key = values[spec.keyColumn] ?? "";
    if (errors.length === 0 && spec.rowCheck) {
      const issue = spec.rowCheck(values, ctx);
      if (issue) errors.push(issue);
    }
    if (errors.length === 0) {
      const dedup = spec.dedupKey ? spec.dedupKey(values) : norm(key);
      if (seen.has(dedup))
        errors.push({ field: spec.keyColumn, error: spec.duplicateMessage ?? "Duplicate row — only the first one is imported." });
      else seen.add(dedup);
    }
    const warnings = errors.length === 0 && spec.warn ? spec.warn(values, ctx) : [];
    return { line: i + 2, key, values, errors, warnings };
  });

  const valid = rows.filter((r) => r.errors.length === 0);
  return {
    rows,
    validCount: valid.length,
    warningCount: valid.filter((r) => r.warnings.length > 0).length,
    errorCount: rows.length - valid.length,
    payload: valid.map((r) => {
      // _line: the server reports errors against the file line shown in the preview.
      const out: Record<string, string> = { _line: String(r.line) };
      for (const c of spec.columns) if (r.values[c.key] !== "") out[c.key] = r.values[c.key];
      return out;
    }),
  };
}
