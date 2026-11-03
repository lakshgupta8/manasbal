import { Body, Controller, Inject, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { storeUpdateInputSchema, type StoreUpdateInput } from "@manasbal/types";
import { AuthGuard } from "../auth/auth.guard.js";
import { type Actor, CurrentActor } from "../auth/current-user.js";
import { Roles, RolesGuard, WRONG_ROLE } from "../auth/roles.js";
import { ApiZodBody, ZodValidationPipe } from "../validation/zod-validation.pipe.js";
import { StoreService } from "./store.service.js";

// A class rather than an interface so the OpenAPI description knows the shape of the answer.
export class OwnStore {
  @ApiProperty({ example: "Quill Threads" })
  storeName: string;

  @ApiProperty({ example: "quill-threads", description: "The store page's address" })
  slug: string;

  @ApiProperty({ example: "approved" })
  status: string;
}

// Store settings: the roadmap's matrix gives them to the seller only. seller_staff gets 403
// (staff accounts are linked to a seller in Phase 10).
@ApiTags("Me")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "No valid access token" })
@ApiForbiddenResponse({ description: WRONG_ROLE })
@UseGuards(AuthGuard, RolesGuard)
@Roles("seller")
@Controller("me/store")
export class StoreController {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(StoreService) private readonly store: Pick<StoreService, "rename">) {}

  @Patch()
  @ApiOperation({
    summary: "Rename your store",
    description:
      "Changes the signed-in seller's store name; the slug (the store page's address) follows it. The change is recorded in the audit log.",
  })
  @ApiZodBody(storeUpdateInputSchema)
  @ApiOkResponse({ type: OwnStore })
  @ApiBadRequestResponse({ description: "The name is too short, too long or has no letters" })
  @ApiNotFoundResponse({ description: "This account has no store" })
  @ApiConflictResponse({ description: "Another store already uses this name" })
  rename(
    @CurrentActor() who: Actor,
    @Body(new ZodValidationPipe(storeUpdateInputSchema)) input: StoreUpdateInput,
  ): Promise<OwnStore> {
    return this.store.rename(who, input);
  }
}
