import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AuditPage as AuditPageShape, OrderSummary } from "@manasbal/types";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../pagination/pagination.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { type Actor, CurrentActor } from "../auth/current-user.js";
import { Roles, RolesGuard, WRONG_ROLE } from "../auth/roles.js";
import { AdminService } from "./admin.service.js";

// Classes rather than interfaces so the OpenAPI description knows the shape of the answer. They
// mirror auditPageSchema in @manasbal/types.
export class AuditEntry {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  actorId: string | null;

  @ApiProperty({ example: "address.create" })
  action: string;

  @ApiProperty({ type: String, nullable: true, example: "address" })
  targetType: string | null;

  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  targetId: string | null;

  @ApiProperty({ description: "The x-request-id of the request that made the change" })
  requestId: string;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

export class AuditPage {
  @ApiProperty({ type: [AuditEntry] })
  items: AuditEntry[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Pass as cursor to get the next page; null on the last page",
  })
  nextCursor: string | null;
}

// One order as staff see it: the same fields as in the owner's own list.
export class AdminOrder {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "placed" })
  status: string;

  @ApiProperty({ type: "integer", minimum: 0, description: "Whole paise" })
  totalPaise: number;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

// For staff. Admin only unless a handler says otherwise; the role comes from the access token.
@ApiTags("Admin")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "No valid access token" })
@ApiForbiddenResponse({ description: WRONG_ROLE })
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin")
@Controller("admin")
export class AdminController {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(@Inject(AdminService) private readonly admin: Pick<AdminService, "list" | "order">) {}

  // Any user's order, for support and admin. Each view is recorded in the audit log.
  @ApiOperation({
    summary: "Read any order",
    description:
      "One order by its id, whoever placed it. Support and admins only; every view is recorded in the audit log as order.view.",
  })
  @Get("orders/:id")
  @Roles("support", "admin")
  @ApiOkResponse({ type: AdminOrder })
  @ApiBadRequestResponse({ description: "The id is not a UUID" })
  @ApiNotFoundResponse({ description: "No order with this id" })
  order(
    @CurrentActor() who: Actor,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<OrderSummary> {
    return this.admin.order(who, id);
  }

  // One page of the audit log, newest first.
  @ApiOperation({
    summary: "Read the audit log",
    description: "One page of recorded changes, newest first. Only admins can read it.",
  })
  @Get("audit-log")
  @ApiQuery({ name: "cursor", required: false, description: "nextCursor from the previous page" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: `1 to ${MAX_LIMIT}, default ${DEFAULT_LIMIT}`,
  })
  @ApiOkResponse({ type: AuditPage })
  @ApiBadRequestResponse({ description: "The cursor or limit is not valid" })
  list(@Query("cursor") cursor?: string, @Query("limit") limit?: string): Promise<AuditPageShape> {
    return this.admin.list({ cursor, limit });
  }
}
