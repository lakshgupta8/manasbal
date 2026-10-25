import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { ReviewPage as ReviewPageShape } from "@manasbal/types";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../pagination/pagination.js";
import { ReviewsService } from "./reviews.service.js";

// Classes rather than interfaces so the OpenAPI description knows the shape of the answer. They
// mirror reviewPageSchema in @manasbal/types.
export class Review {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty()
  body: string;

  @ApiProperty({ description: "The reviewer first name only" })
  authorName: string;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

export class ReviewPage {
  @ApiProperty({ type: [Review] })
  items: Review[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Pass as cursor to get the next page; null on the last page",
  })
  nextCursor: string | null;
}

@ApiTags("Catalog")
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // One page of a product's reviews, newest first.
  @ApiOperation({
    summary: "List a product's reviews",
    description: "One page of reviews for a product. Only the reviewer's first name is shown.",
  })
  @Get("products/:slug/reviews")
  @ApiQuery({ name: "cursor", required: false, description: "nextCursor from the previous page" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: `1 to ${MAX_LIMIT}, default ${DEFAULT_LIMIT}`,
  })
  @ApiOkResponse({ type: ReviewPage })
  @ApiBadRequestResponse({ description: "The cursor or limit is not valid" })
  @ApiNotFoundResponse({ description: "No such product" })
  list(
    @Param("slug") slug: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<ReviewPageShape> {
    return this.reviews.list(slug, { cursor, limit });
  }
}
