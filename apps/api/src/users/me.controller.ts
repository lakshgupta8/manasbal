import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUserId } from "../auth/current-user.js";
import { MeService } from "./me.service.js";

// A class rather than an interface so the OpenAPI description (and the generated SDK) knows
// the shape of the answer.
export class Me {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ example: "buyer" })
  role: string;
}

@ApiTags("Me")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "No valid access token, or the account is gone" })
@UseGuards(AuthGuard)
@Controller("me")
export class MeController {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(MeService) private readonly me: Pick<MeService, "get">) {}

  @ApiOperation({ summary: "Who am I", description: "The signed-in user's name, email and role." })
  @Get()
  @ApiOkResponse({ type: Me })
  get(@CurrentUserId() userId: string): Promise<Me> {
    return this.me.get(userId);
  }
}
