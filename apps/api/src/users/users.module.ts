import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AddressesController } from "./addresses.controller.js";
import { AddressesService } from "./addresses.service.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";
import { SessionsController } from "./sessions.controller.js";
import { SessionsService } from "./sessions.service.js";
import { StoreController } from "./store.controller.js";
import { StoreService } from "./store.service.js";

@Module({
  imports: [AuthModule],
  controllers: [MeController, AddressesController, StoreController, SessionsController],
  providers: [AddressesService, MeService, StoreService, SessionsService],
})
export class UsersModule {}
