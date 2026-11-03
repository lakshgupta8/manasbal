import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AddressesController } from "./addresses.controller.js";
import { AddressesService } from "./addresses.service.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";
import { StoreController } from "./store.controller.js";
import { StoreService } from "./store.service.js";

@Module({
  imports: [AuthModule],
  controllers: [MeController, AddressesController, StoreController],
  providers: [AddressesService, MeService, StoreService],
})
export class UsersModule {}
