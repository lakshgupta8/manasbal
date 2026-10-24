import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AuditPage as AuditPageShape } from "@manasbal/types";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../pagination/pagination.js";
import { DEMO_USER_HEADER, DemoUserGuard } from "../users/demo-user.guard.js";
import { AdminGuard } from "./admin.guard.js";
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

  @ApiProperty({ example: "address" })
  targetType: string;

  @ApiProperty({ format: "uuid" })
  targetId: string;

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

// Only for users whose role is admin.
@ApiTags("Admin")
@ApiHeader({
  name: DEMO_USER_HEADER,
  description: "Id of the user to act as. Outside production only, until sign-in exists.",
  required: true,
})
@ApiUnauthorizedResponse({ description: "No user, or the API runs in production" })
@ApiForbiddenResponse({ description: "The user is not an admin" })
@UseGuards(DemoUserGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // One page of the audit log, newest first.
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
