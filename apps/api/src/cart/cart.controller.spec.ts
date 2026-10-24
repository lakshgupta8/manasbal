import type { ExecutionContext } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { InjectOptions } from "fastify";
import { ProblemDetailsFilter } from "../errors/problem-details.filter.js";
import { DEMO_USER_HEADER, DemoUserGuard } from "../users/demo-user.guard.js";
import { CartModule } from "./cart.module.js";
import { CartService } from "./cart.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const VARIANT_ID = "1a2b3c4d-0000-4000-8000-0000000000a1";

// Every endpoint, called the way a client that knows the demo header would call it.
const requests: InjectOptions[] = [
  { method: "GET", url: "/cart" },
  { method: "POST", url: "/cart/items", payload: { variantId: VARIANT_ID, quantity: 1 } },
];

// The stock rules need a real database and live in test/cart.e2e-spec.ts. This one needs none:
// in production the guard refuses before anything is looked up.
describe("CartController in production", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CartModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(requests)("$method $url answers 401", async (request) => {
    const response = await app.inject({ ...request, headers: { [DEMO_USER_HEADER]: USER_ID } });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });
});

// The controller's own part: each endpoint hands the signed-in user's id and the parsed body
// to the service, and answers with the right status.
describe("CartController", () => {
  let app: NestFastifyApplication;
  const service = {
    get: vi.fn(),
    addItem: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CartModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    })
      .overrideProvider(CartService)
      .useValue(service)
      .overrideGuard(DemoUserGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<{ userId?: string }>().userId = USER_ID;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers the user's cart", async () => {
    service.get.mockResolvedValue({ items: [], subtotalPaise: 0 });

    const response = await app.inject(requests[0]!);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], subtotalPaise: 0 });
    expect(service.get).toHaveBeenCalledWith(USER_ID);
  });

  it("adds an item from the parsed body", async () => {
    service.addItem.mockResolvedValue({ items: [], subtotalPaise: 0 });

    const response = await app.inject(requests[1]!);

    expect(response.statusCode).toBe(201);
    expect(service.addItem).toHaveBeenCalledWith(USER_ID, requests[1]!.payload);
  });

  it.each([
    ["a quantity of 0", { variantId: VARIANT_ID, quantity: 0 }],
    ["a quantity over 10", { variantId: VARIANT_ID, quantity: 11 }],
    ["a variant that isn't a uuid", { variantId: "nope", quantity: 1 }],
    ["a price", { variantId: VARIANT_ID, quantity: 1, pricePaise: 1 }],
  ])("answers 400 for %s, without asking the service", async (_name, payload) => {
    const response = await app.inject({ method: "POST", url: "/cart/items", payload });

    expect(response.statusCode).toBe(400);
    expect(service.addItem).not.toHaveBeenCalled();
  });
});
