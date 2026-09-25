
export interface RowError {
  row: number; // line in the CSV file; the header is line 1, so data starts at 2
  key: string;
  field: string;
  error: string;
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: RowError[];
}

export function emptySummary(): ImportSummary {
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

export function normaliseUsn(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}
