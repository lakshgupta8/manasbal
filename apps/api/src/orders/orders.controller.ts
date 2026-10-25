import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { OrderPage as OrderPageShape } from "@manasbal/types";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../pagination/pagination.js";
import { CurrentUserId, DEMO_USER_HEADER, DemoUserGuard } from "../users/demo-user.guard.js";
import { OrdersService } from "./orders.service.js";

// Classes rather than interfaces so the OpenAPI description knows the shape of the answer. They
// mirror orderPageSchema in @manasbal/types.
export class OrderSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: "integer", minimum: 0, description: "Whole paise" })
  totalPaise: number;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

export class OrderPage {
  @ApiProperty({ type: [OrderSummary] })
  items: OrderSummary[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Pass as cursor to get the next page; null on the last page",
  })
  nextCursor: string | null;
}

// The signed-in user's orders.
@ApiTags("Orders")
@ApiHeader({
  name: DEMO_USER_HEADER,
  description:
    "Id of the user to act as. Outside production only, until sign-in exists. The API client's demoUser option sets it.",
  required: false,
})
@ApiUnauthorizedResponse({ description: "No user, or the API runs in production" })
@UseGuards(DemoUserGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // One page of the user's orders, newest first.
  @ApiOperation({
    summary: "List my orders",
    description: "One page of the demo user's orders, newest first. Totals are whole paise.",
  })
  @Get()
  @ApiQuery({ name: "cursor", required: false, description: "nextCursor from the previous page" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: `1 to ${MAX_LIMIT}, default ${DEFAULT_LIMIT}`,
  })
  @ApiOkResponse({ type: OrderPage })
  @ApiBadRequestResponse({ description: "The cursor or limit is not valid" })
  list(
    @CurrentUserId() userId: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<OrderPageShape> {
    return this.orders.list(userId, { cursor, limit });
  }
}
