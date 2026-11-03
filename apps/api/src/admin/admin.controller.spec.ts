import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { ExecutionContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ProblemDetailsFilter } from "../errors/problem-details.filter.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AdminModule } from "./admin.module.js";
import { AdminService } from "./admin.service.js";

// Stands in for AuthGuard: the role comes from an x-test-role header instead of a token, so the
// real RolesGuard decides. The full role matrix with real tokens is in test/roles.e2e-spec.ts.
const signedIn = {
  canActivate: (context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; role?: string }>();
    request.role = request.headers["x-test-role"];
    return true;
  },
};

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
      .overrideGuard(AuthGuard)
      .useValue(signedIn)
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
      headers: { "x-test-role": "admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], nextCursor: null });
    expect(service.list).toHaveBeenCalledWith({ cursor: "abc", limit: "5" });
  });

  it("answers 403 problem+json to any role but admin, before reading the log", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/audit-log",
      headers: { "x-test-role": "support" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({
      status: 403,
      detail: "You can't do this with your role",
    });
    expect(service.list).not.toHaveBeenCalled();
  });
});
