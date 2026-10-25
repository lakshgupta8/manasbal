import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiProperty, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CategoryNode } from "@manasbal/types";
import { CategoriesService } from "./categories.service.js";

// A class rather than an interface so the OpenAPI description knows the shape of the answer. It
// mirrors categoryNodeSchema in @manasbal/types.
export class Category {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ type: () => [Category] })
  children: Category[];
}

@ApiTags("Catalog")
@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // The top-level categories, each with its subcategories nested under children.
  @ApiOperation({
    summary: "List categories",
    description: "The whole category tree, each level sorted by name.",
  })
  @Get("categories")
  @ApiOkResponse({ type: [Category] })
  list(): Promise<CategoryNode[]> {
    return this.categories.tree();
  }
}
