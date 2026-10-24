import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type {
  ProductPage as ProductPageShape,
  ProductStock as ProductStockShape,
  ProductSummary as ProductSummaryShape,
} from "@manasbal/types";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../pagination/pagination.js";
import { ProductsService } from "./products.service.js";

// Classes rather than interfaces so the OpenAPI description knows the shape of the answer. They
// mirror productPageSchema in @manasbal/types.
export class ProductCategory {
  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;
}

export class ProductSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    type: "integer",
    nullable: true,
    description: "The cheapest variant's price in whole paise, or null when there are no variants",
    example: 49900,
  })
  pricePaise: number | null;

  // Typed with the shared shape, not the class: a class type makes the decorator metadata emit a
  // branch that never runs. The decorator still documents it as ProductCategory.
  @ApiProperty({ type: ProductCategory })
  category: ProductSummaryShape["category"];
}

export class ProductPage {
  @ApiProperty({ type: [ProductSummary] })
  items: ProductSummary[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Pass as cursor to get the next page; null on the last page",
  })
  nextCursor: string | null;
}

export class VariantStock {
  @ApiProperty({ format: "uuid" })
  variantId: string;

  @ApiProperty()
  sku: string;

  @ApiProperty({ type: String, nullable: true })
  size: string | null;

  @ApiProperty({ type: String, nullable: true })
  colour: string | null;

  @ApiProperty({
    type: "integer",
    minimum: 0,
    description: "Quantity minus reserved over every location, never below 0",
    example: 7,
  })
  available: number;
}

export class ProductStock {
  @ApiProperty({ format: "uuid" })
  productId: string;

  @ApiProperty({ type: [VariantStock] })
  variants: VariantStock[];
}

@ApiTags("Catalog")
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // One page of products, sorted by id. A category slug keeps only that category's products.
  @Get("products")
  @ApiQuery({ name: "category", required: false, description: "Category slug" })
  @ApiQuery({ name: "cursor", required: false, description: "nextCursor from the previous page" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: `1 to ${MAX_LIMIT}, default ${DEFAULT_LIMIT}`,
  })
  @ApiOkResponse({ type: ProductPage })
  @ApiBadRequestResponse({ description: "The cursor or limit is not valid" })
  list(
    @Query("category") category?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<ProductPageShape> {
    return this.products.list({ category, cursor, limit });
  }

  // How many of each variant of a product can be bought right now.
  @Get("products/:id/stock")
  @ApiOkResponse({ type: ProductStock })
  @ApiBadRequestResponse({ description: "The id is not a uuid" })
  @ApiNotFoundResponse({ description: "No such product" })
  stock(@Param("id", ParseUUIDPipe) id: string): Promise<ProductStockShape> {
    return this.products.stock(id);
  }
}
