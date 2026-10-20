import { BadRequestException } from "@nestjs/common";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PageQuery {
  cursor?: string;
  limit?: string;
}

export interface PageParams {
  // Key of the last row the client already has, decoded from the opaque cursor.
  after: string | undefined;
  limit: number;
  // Ask the database for this many rows, so one extra row tells us another page exists.
  take: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// The cursor is opaque to clients: today it wraps a row key, tomorrow it can wrap more.
export function encodeCursor(key: string): string {
  return Buffer.from(key, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): string {
  const key = Buffer.from(cursor, "base64url").toString("utf8");
  if (key === "" || encodeCursor(key) !== cursor) {
    throw new BadRequestException("cursor is not valid");
  }
  return key;
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!/^\d+$/.test(raw)) {
    throw new BadRequestException("limit must be a whole number");
  }
  const limit = Number(raw);
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new BadRequestException(`limit must be between 1 and ${MAX_LIMIT}`);
  }
  return limit;
}

export function parsePageQuery(query: PageQuery): PageParams {
  const limit = parseLimit(query.limit);
  const after = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
  return { after, limit, take: limit + 1 };
}

// `rows` is what the database returned for `take` rows; keyOf gives each row's cursor key.
export function toPage<T>(rows: T[], params: PageParams, keyOf: (row: T) => string): Page<T> {
  const items = rows.slice(0, params.limit);
  const last = items.at(-1);
  const hasMore = rows.length > params.limit && last !== undefined;
  return { items, nextCursor: hasMore ? encodeCursor(keyOf(last)) : null };
}
