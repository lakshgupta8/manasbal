import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ReviewPage } from "@manasbal/types";
import { z } from "zod";
import { parsePageQuery, toPage, type PageQuery } from "../pagination/pagination.js";
import { getDb } from "../prisma/db.js";

// A review's place in the list: when it was written, then its id to break ties.
interface ReviewKey {
  createdAt: string;
  id: string;
}

// The cursor key is `${createdAt}|${id}`. Anything else is the client's mistake, not a 500.
function parseKey(key: string): ReviewKey {
  const [createdAt, id, ...rest] = key.split("|");
  if (
    rest.length > 0 ||
    !z.iso.datetime().safeParse(createdAt).success ||
    !z.uuid().safeParse(id).success
  ) {
    throw new BadRequestException("cursor is not valid");
  }
  return { createdAt: createdAt!, id: id! };
}

@Injectable()
export class ReviewsService {
  async list(slug: string, { cursor, limit }: PageQuery): Promise<ReviewPage> {
    const params = parsePageQuery({ cursor, limit });
    const after = params.after === undefined ? undefined : parseKey(params.after);

    const db = getDb().orm.public;
    const product = await db.Product.where({ slug }).select("id").first();
    // A 404 rather than an empty list, so a typo in the slug doesn't pass for a product without reviews.
    if (product === null) throw new NotFoundException("No product with this slug");

    const ordered = db.Review.where({ productId: product.id }).orderBy([
      (r) => r.createdAt.desc(),
      (r) => r.id.desc(),
    ]);
    const paged =
      after === undefined
        ? ordered
        : ordered.cursor({ createdAt: Temporal.Instant.from(after.createdAt), id: after.id });
    const rows = await paged
      .limit(params.take)
      .select("id", "rating", "body", "createdAt")
      .include("user", (u) => u.select("name"))
      .all();

    const items = rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      body: row.body,
      // First name only: the rest of the name, the email and the user id stay private.
      authorName: (row.user?.name ?? "").split(" ")[0]!,
      createdAt: row.createdAt.toString(),
    }));
    return toPage(items, params, (r) => `${r.createdAt}|${r.id}`);
  }
}
