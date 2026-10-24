import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import type { ProductStock as ProductStockShape } from "@manasbal/types";
import { StockService } from "./stock.service.js";

// Classes rather than interfaces so the OpenAPI description knows the shape of the answer. They
// mirror productStockSchema in @manasbal/types.
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
export class StockController {
  constructor(private readonly stock: StockService) {}

  // How many of each variant of a product can be bought right now.
  @Get("products/:id/stock")
  @ApiOkResponse({ type: ProductStock })
  @ApiBadRequestResponse({ description: "The id is not a uuid" })
  @ApiNotFoundResponse({ description: "No such product" })
  get(@Param("id", ParseUUIDPipe) id: string): Promise<ProductStockShape> {
    return this.stock.forProduct(id);
  }
}
