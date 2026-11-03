import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Session as SessionShape } from "@manasbal/types";
import { AuthGuard } from "../auth/auth.guard.js";
import type { AuthedRequest } from "../auth/current-user.js";
import { NO_SESSION, SessionsService } from "./sessions.service.js";

// A class rather than an interface so the OpenAPI description (and the generated SDK) knows the
// shape. Mirrors sessionSchema in @manasbal/types.
export class Session {
  @ApiProperty({ format: "uuid", description: "Pass it to DELETE /me/sessions/{id}" })
  id: string;

  @ApiProperty({ example: "Firefox on Windows" })
  browser: string;

  @ApiProperty({ format: "date-time" })
  startedAt: string;

  @ApiProperty({ format: "date-time" })
  lastUsedAt: string;

  @ApiProperty({ description: "The session this access token belongs to" })
  current: boolean;
}

@ApiTags("Me")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "No valid access token" })
@UseGuards(AuthGuard)
@Controller("me/sessions")
export class SessionsController {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(
    @Inject(SessionsService) private readonly sessions: Pick<SessionsService, "list" | "end">,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Where I am signed in",
    description: "One entry per signed-in device or browser, most recently used first.",
  })
  @ApiOkResponse({ type: [Session] })
  list(@Req() request: Pick<AuthedRequest, "userId" | "sessionId">): Promise<SessionShape[]> {
    return this.sessions.list(request.userId!, request.sessionId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "End a session",
    description:
      "Signs that browser out: its refresh token stops working. Its access token works until it expires (15 minutes). Ending the current session is allowed.",
  })
  @ApiNoContentResponse({ description: "The session is ended" })
  @ApiBadRequestResponse({ description: "The id is not a UUID" })
  @ApiNotFoundResponse({ description: NO_SESSION })
  end(
    @Req() request: Pick<AuthedRequest, "userId" | "id">,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.sessions.end({ userId: request.userId!, requestId: String(request.id) }, id);
  }
}
