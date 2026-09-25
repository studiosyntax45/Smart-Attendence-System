
export interface ExportColumn {
  
  key: string;
  
  label: string;
}


export type ExportRow = Record<string, string | number | null | undefined>;


function cellText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}


function csvField(raw: string): string {
  let value = raw;
  if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  if (/[",\n\r]/.test(value)) {
    value = `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}


export function rowsToCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvField).join(",")).join("\r\n");
}

export function toCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  return rowsToCsv([
    columns.map((c) => c.label),
    ...rows.map((row) => columns.map((c) => cellText(row[c.key]))),
  ]);
}

/** BOM first so Excel reads the file as UTF-8. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface PrintableOptions {
  title: string;
  
  subtitle?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}


export function toPrintableHtml({
  title,
  subtitle,
  columns,
  rows,
}: PrintableOptions): string {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td>${escapeHtml(cellText(row[c.key]))}</td>`)
          .join("")}</tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .subtitle { color: #555; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .footer { margin-top: 16px; color: #888; font-size: 10px; }
  @media print { body { margin: 12mm; } .footer { position: fixed; bottom: 8mm; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="footer">PES Smart Attendance · ${rows.length} row${rows.length === 1 ? "" : "s"}</p>
</body>
</html>`;
}


export function slugifyFilename(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "export"
  );
}


/** exportFilename("attendance", ["CS301", "A"]) -> "attendance_CS301_A_2026-09-24" */
export function exportFilename(prefix: string, parts: Array<string | null | undefined>, date = new Date()): string {
  const clean = (v: string) => v.trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const bits = [prefix, ...parts.filter((p): p is string => !!p && p.trim() !== "")].map(clean).filter(Boolean);
  // en-CA formats as YYYY-MM-DD in the viewer's own time zone (IST for the college).
  return [...bits, date.toLocaleDateString("en-CA")].join("_");
}
