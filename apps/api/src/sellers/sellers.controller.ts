import { Controller, Get, Param } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiProperty, ApiTags } from "@nestjs/swagger";
import type { SellerStore as SellerStoreShape } from "@manasbal/types";
import { SellersService } from "./sellers.service.js";

// A class rather than an interface so the OpenAPI description knows the shape of the answer. It
// mirrors sellerStoreSchema in @manasbal/types.
export class SellerStore {
  @ApiProperty()
  slug: string;

  @ApiProperty()
  storeName: string;

  @ApiProperty({ type: "integer", minimum: 0, description: "How many products the store lists" })
  productCount: number;
}

@ApiTags("Sellers")
@Controller()
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  // A store's public page. Only approved stores are shown.
  @Get("sellers/:slug")
  @ApiOkResponse({ type: SellerStore })
  @ApiNotFoundResponse({ description: "No such store, or it is not approved yet" })
  store(@Param("slug") slug: string): Promise<SellerStoreShape> {
    return this.sellers.store(slug);
  }
}
