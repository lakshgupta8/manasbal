import type { ExecutionContext } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ProblemDetailsFilter } from "../errors/problem-details.filter.js";
import { DEMO_USER_HEADER, DemoUserGuard } from "../users/demo-user.guard.js";
import { OrdersModule } from "./orders.module.js";
import { OrdersService } from "./orders.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";

// The query needs a real database and lives in test/orders.e2e-spec.ts. This one needs none: in
// production the guard refuses before anything is looked up.
describe("OrdersController in production", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OrdersModule],
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

  it("GET /orders answers 401", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/orders",
      headers: { [DEMO_USER_HEADER]: USER_ID },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });
});

// The controller's own part: the endpoint hands the signed-in user's id and the paging query to
// the service.
describe("OrdersController", () => {
  let app: NestFastifyApplication;
  const service = { list: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OrdersModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    })
      .overrideProvider(OrdersService)
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

  it("lists the user's orders, passing the cursor and limit on", async () => {
    service.list.mockResolvedValue({ items: [], nextCursor: null });

    const response = await app.inject({ method: "GET", url: "/orders?cursor=abc&limit=5" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], nextCursor: null });
    expect(service.list).toHaveBeenCalledWith(USER_ID, { cursor: "abc", limit: "5" });
  });
});
