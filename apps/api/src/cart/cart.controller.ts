import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { cartItemInputSchema, type Cart as CartShape, type CartItemInput } from "@manasbal/types";
import { ApiZodBody, ZodValidationPipe } from "../validation/zod-validation.pipe.js";
import { CurrentUserId, DEMO_USER_HEADER, DemoUserGuard } from "../users/demo-user.guard.js";
import { CartService } from "./cart.service.js";

// Classes rather than interfaces so the OpenAPI description knows the shape of the answer. They
// mirror cartSchema in @manasbal/types.
export class CartLine {
  @ApiProperty({ format: "uuid" })
  variantId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  sku: string;

  @ApiProperty({ type: "integer", minimum: 1 })
  quantity: number;

  @ApiProperty({ type: "integer", minimum: 0, description: "Whole paise", example: 49900 })
  unitPricePaise: number;

  @ApiProperty({ type: "integer", minimum: 0, description: "Whole paise", example: 99800 })
  linePaise: number;
}

export class Cart {
  @ApiProperty({ type: [CartLine], description: "Sorted by product name, then SKU" })
  items: CartLine[];

  @ApiProperty({ type: "integer", minimum: 0, description: "Whole paise" })
  subtotalPaise: number;
}

// The signed-in user's cart.
@ApiTags("Cart")
@ApiHeader({
  name: DEMO_USER_HEADER,
  description:
    "Id of the user to act as. Outside production only, until sign-in exists. The API client's demoUser option sets it.",
  required: false,
})
@ApiUnauthorizedResponse({ description: "No user, or the API runs in production" })
@UseGuards(DemoUserGuard)
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOkResponse({ type: Cart })
  get(@CurrentUserId() userId: string): Promise<CartShape> {
    return this.cart.get(userId);
  }

  // Adding a variant that is already in the cart raises the quantity of its line.
  @Post("items")
  @ApiHeader({
    name: "Idempotency-Key",
    description: "Repeats of the same key answer the first result instead of adding again",
    required: false,
  })
  @ApiZodBody(cartItemInputSchema)
  @ApiCreatedResponse({ type: Cart })
  @ApiNotFoundResponse({ description: "No such variant" })
  @ApiConflictResponse({ description: "More than the stock" })
  addItem(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(cartItemInputSchema)) input: CartItemInput,
  ): Promise<CartShape> {
    return this.cart.addItem(userId, input);
  }
}
