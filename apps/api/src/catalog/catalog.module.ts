import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller.js";
import { CategoriesService } from "./categories.service.js";
import { ProductsController } from "./products.controller.js";
import { ProductsService } from "./products.service.js";
import { StockController } from "./stock.controller.js";
import { StockService } from "./stock.service.js";

@Module({
  controllers: [CategoriesController, ProductsController, StockController],
  providers: [CategoriesService, ProductsService, StockService],
})
export class CatalogModule {}
