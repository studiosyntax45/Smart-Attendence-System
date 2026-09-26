import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";

export interface SchemaCheckResult {
  ok: boolean;
  /** Set when the database could not be queried at all. */
  error?: string;
  missingTables: string[];
  /** "table.column" entries. */
  missingColumns: string[];
}

/**
 * Compares the tables/columns schema.prisma expects with what the connected
 * database actually has. A database that predates a schema change makes the
 * pages using the new tables fail with a 500, so this is surfaced at boot.
 */
export async function checkDatabaseSchema(): Promise<SchemaCheckResult> {
  let rows: Array<{ table_name: string; column_name: string }>;
  try {
    rows = await prisma.$queryRaw`
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
    `;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message.trim().split("\n").pop() : String(err),
      missingTables: [],
      missingColumns: [],
    };
  }

  const actual = new Map<string, Set<string>>();
  for (const r of rows) {
    const table = r.table_name.toLowerCase();
    if (!actual.has(table)) actual.set(table, new Set());
    actual.get(table)!.add(r.column_name.toLowerCase());
  }

  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const model of Prisma.dmmf.datamodel.models) {
    const table = model.dbName ?? model.name;
    const columns = actual.get(table.toLowerCase());
    if (!columns) {
      missingTables.push(table);
      continue;
    }
    for (const field of model.fields) {
      if (field.kind !== "scalar" && field.kind !== "enum") continue;
      const column = (field as { dbName?: string | null }).dbName ?? field.name;
      if (!columns.has(column.toLowerCase())) missingColumns.push(`${table}.${column}`);
    }
  }

  return {
    ok: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns,
  };
}

export async function reportDatabaseSchema(): Promise<void> {
  const r = await checkDatabaseSchema();
  if (r.ok) return;
  const lines = ["", "================ DATABASE PROBLEM ================"];
  if (r.error) {
    lines.push(`Cannot reach the database: ${r.error}`);
    lines.push("Check that MySQL is running and DATABASE_URL in .env is correct.");
  } else {
    lines.push("The database schema is out of date, so some pages will not load.");
    if (r.missingTables.length) lines.push(`Missing tables:  ${r.missingTables.join(", ")}`);
    if (r.missingColumns.length) lines.push(`Missing columns: ${r.missingColumns.join(", ")}`);
    lines.push("Fix: stop the server, run `npm --prefix server run prisma:push`, then start it again.");
  }
  lines.push("==================================================", "");
  console.error(lines.join("\n"));
}
