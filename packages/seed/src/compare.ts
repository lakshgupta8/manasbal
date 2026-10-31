import { contractTables } from "./reset.ts";

// Runs one SQL statement and returns its output as text, like the test database helper's sql().
export type Query = (statement: string) => Promise<string>;

export type Dump = Record<string, unknown[]>;

export interface Difference {
  table: string;
  index: number;
  // An empty side means that table has fewer rows.
  left: unknown;
  right: unknown;
}

// Every row of every table in the contract, ordered by id, as plain JSON.
export async function dumpTables(query: Query, tables = contractTables()): Promise<Dump> {
  const dump: Dump = {};
  for (const table of tables) {
    const text = await query(`SELECT coalesce(json_agg(t ORDER BY t.id), '[]') FROM "${table}" t`);
    dump[table] = JSON.parse(text) as unknown[];
  }
  return dump;
}

// The first row that differs between two dumps, table by table, or null when they match. A table
// with fewer rows on one side differs at the first row it is missing.
export function firstDifference(a: Dump, b: Dump): Difference | null {
  const tables = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) =>
    x.localeCompare(y),
  );
  for (const table of tables) {
    const left = a[table] ?? [];
    const right = b[table] ?? [];
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
      if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) {
        return { table, index, left: left[index] ?? null, right: right[index] ?? null };
      }
    }
  }
  return null;
}
