import { norm, parseCsv } from "./csv.ts";

const USN_HEADERS = ["usn", "srn", "rollno", "rollnumber", "prn"];
const NAME_HEADERS = ["studentname", "name", "fullname"];
const MARKS_HEADERS = ["marks", "mark", "score", "marksobtained"];

export interface ImportStudent {
  id: string;
  full_name: string;
  roll_no: string | null;
}

export interface MarksPreviewRow {
  line: number;
  usn: string;
  name: string;
  score: number | null;
  studentId?: string;
  studentName?: string;
  /** ready = new mark, update = overwrites an existing mark, error = skipped. */
  status: "ready" | "update" | "error";
  message?: string;
  warning?: string;
}

export function buildMarksPreview(
  text: string,
  opts: { students: ImportStudent[]; maxScore: number; alreadyMarked?: Set<string> }
): { rows: MarksPreviewRow[]; error?: string } {
  const [header, ...data] = parseCsv(text);
  if (!header) return { rows: [], error: "The file is empty." };

  const cols = header.map(norm);
  const usnCol = cols.findIndex((c) => USN_HEADERS.includes(c));
  const nameCol = cols.findIndex((c) => NAME_HEADERS.includes(c));
  const marksCol = cols.findIndex((c) => MARKS_HEADERS.includes(c));
  if (usnCol < 0 || marksCol < 0) {
    return {
      rows: [],
      error: `The first row must have a USN column and a Marks column. Found: ${header.join(", ")}. Download the template to see the expected format.`,
    };
  }

  const byUsn = new Map(
    opts.students.filter((s) => s.roll_no).map((s) => [norm(s.roll_no!), s])
  );
  const seen = new Set<string>();

  const rows = data.map((r, i): MarksPreviewRow => {
    const usn = r[usnCol] ?? "";
    const name = nameCol >= 0 ? r[nameCol] ?? "" : "";
    const rawScore = r[marksCol] ?? "";
    const base = { line: i + 2, usn, name, score: null };
    const fail = (message: string): MarksPreviewRow => ({ ...base, status: "error", message });

    if (!usn) return fail("USN is empty.");
    const key = norm(usn);
    if (seen.has(key)) return fail("Duplicate USN — only the first row is used.");
    seen.add(key);

    const student = byUsn.get(key);
    if (!student) return fail("USN not found among registered students.");

    if (/^(ab|absent|a)$/i.test(rawScore)) return fail("Marked absent (AB) — skipped.");
    const score = Number(rawScore);
    if (rawScore === "" || !Number.isFinite(score)) return fail(`Marks "${rawScore}" is not a number.`);
    if (score < 0 || score > opts.maxScore) return fail(`Marks must be between 0 and ${opts.maxScore}.`);

    const warning =
      name && norm(name) !== norm(student.full_name)
        ? `Name in file ("${name}") differs from "${student.full_name}".`
        : undefined;
    return {
      ...base,
      score,
      studentId: student.id,
      studentName: student.full_name,
      status: opts.alreadyMarked?.has(student.id) ? "update" : "ready",
      warning,
    };
  });

  return { rows };
}
