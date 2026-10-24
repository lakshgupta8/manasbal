import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ProblemDetailsFilter } from "../errors/problem-details.filter.js";
import { DemoUserGuard } from "../users/demo-user.guard.js";
import { AdminGuard } from "./admin.guard.js";
import { AdminModule } from "./admin.module.js";
import { AdminService } from "./admin.service.js";

const allow = { canActivate: () => true };

// The log itself needs a real database and lives in test/admin.e2e-spec.ts. The controller's own
// part: it hands the paging query to the service.
describe("AdminController", () => {
  let app: NestFastifyApplication;
  const service = { list: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    })
      .overrideProvider(AdminService)
      .useValue(service)
      .overrideGuard(DemoUserGuard)
      .useValue(allow)
      .overrideGuard(AdminGuard)
      .useValue(allow)
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

  it("lists the audit log, passing the cursor and limit on", async () => {
    service.list.mockResolvedValue({ items: [], nextCursor: null });

    const response = await app.inject({
      method: "GET",
      url: "/admin/audit-log?cursor=abc&limit=5",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], nextCursor: null });
    expect(service.list).toHaveBeenCalledWith({ cursor: "abc", limit: "5" });
  });
});
