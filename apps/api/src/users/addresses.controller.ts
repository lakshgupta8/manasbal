import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  addressInputSchema,
  addressPatchSchema,
  type AddressInput,
  type AddressPatch,
} from "@manasbal/types";
import { ApiZodBody, ZodValidationPipe } from "../validation/zod-validation.pipe.js";
import { AddressesService } from "./addresses.service.js";
import {
  type Actor,
  CurrentActor,
  CurrentUserId,
  DEMO_USER_HEADER,
  DemoUserGuard,
} from "./demo-user.guard.js";

// A class rather than an interface so the OpenAPI description (and the generated SDK) knows
// the shape of the answer.
export class Address {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  line1: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty({ example: "190006" })
  pincode: string;

  @ApiProperty()
  isDefault: boolean;
}

// The signed-in user's delivery addresses. The default one comes first.
@ApiTags("Addresses")
@ApiHeader({
  name: DEMO_USER_HEADER,
  description:
    "Id of the user to act as. Outside production only, until sign-in exists. The API client's demoUser option sets it.",
  required: false,
})
@ApiUnauthorizedResponse({ description: "No user, or the API runs in production" })
@UseGuards(DemoUserGuard)
@Controller("me/addresses")
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  // list
  @ApiOperation({
    summary: "List my addresses",
    description: "Every delivery address the demo user has saved, sorted by name.",
  })
  @Get()
  @ApiOkResponse({ type: [Address] })
  list(@CurrentUserId() userId: string): Promise<Address[]> {
    return this.addresses.list(userId);
  }

  // create
  @ApiOperation({
    summary: "Add an address",
    description:
      "Saves a new delivery address for the demo user. The change is written to the audit log.",
  })
  @Post()
  @ApiZodBody(addressInputSchema)
  @ApiCreatedResponse({ type: Address })
  create(
    @CurrentActor() who: Actor,
    @Body(new ZodValidationPipe(addressInputSchema)) input: AddressInput,
  ): Promise<Address> {
    return this.addresses.create(who, input);
  }

  // update
  @ApiOperation({
    summary: "Change an address",
    description: "Updates only the fields sent. The change is written to the audit log.",
  })
  @Patch(":id")
  @ApiZodBody(addressPatchSchema)
  @ApiOkResponse({ type: Address })
  @ApiNotFoundResponse({ description: "The user has no address with this id" })
  update(
    @CurrentActor() who: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addressPatchSchema)) patch: AddressPatch,
  ): Promise<Address> {
    return this.addresses.update(who, id, patch);
  }

  // remove
  @ApiOperation({
    summary: "Delete an address",
    description:
      "Deletes one of the demo user's addresses. An address an order was sent to cannot be deleted. The change is written to the audit log.",
  })
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "The user has no address with this id" })
  @ApiConflictResponse({ description: "An order was sent to this address" })
  remove(@CurrentActor() who: Actor, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.addresses.remove(who, id);
  }
}
