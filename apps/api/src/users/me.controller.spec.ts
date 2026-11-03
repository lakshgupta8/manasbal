import type { ExecutionContext } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { AuditModule } from "../audit/audit.module.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { ProblemDetailsFilter } from "../errors/problem-details.filter.js";
import { MeService } from "./me.service.js";
import { UsersModule } from "./users.module.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";

async function start(override: (builder: TestingModuleBuilder) => TestingModuleBuilder) {
  const builder = Test.createTestingModule({
    imports: [AuditModule, UsersModule],
    providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
  });
  const moduleRef = await override(builder).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

// Without an access token the real guard refuses before anything is looked up.
describe("MeController without a token", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await start((builder) => builder);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /me answers 401", async () => {
    const response = await app.inject({ method: "GET", url: "/me" });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });
});

describe("MeController", () => {
  let app: NestFastifyApplication;
  const service = { get: vi.fn() };

  beforeAll(async () => {
    app = await start((builder) =>
      builder
        .overrideProvider(MeService)
        .useValue(service)
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate: (context: ExecutionContext) => {
            context.switchToHttp().getRequest<{ userId?: string }>().userId = USER_ID;
            return true;
          },
        }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /me answers the signed-in user", async () => {
    const me = {
      id: USER_ID,
      name: "Test Buyer",
      email: "test.buyer@example.test",
      role: "customer",
    };
    service.get.mockResolvedValue(me);

    const response = await app.inject({ method: "GET", url: "/me" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(me);
    expect(service.get).toHaveBeenCalledWith(USER_ID);
  });
});
