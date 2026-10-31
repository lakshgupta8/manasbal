// Rows per INSERT. Large enough to keep the seed fast, small enough to stay well under Postgres's
// limit of 65,535 parameters per statement.
export const BATCH_SIZE = 500;

// Inserts the rows BATCH_SIZE at a time, in order, and returns how many were inserted.
export async function insertInBatches<Row>(
  rows: readonly Row[],
  insert: (batch: Row[]) => PromiseLike<number>,
): Promise<number> {
  let inserted = 0;
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    inserted += await insert(rows.slice(start, start + BATCH_SIZE));
  }
  return inserted;
}
