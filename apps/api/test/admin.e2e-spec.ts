import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { auditPageSchema } from "@manasbal/types";
import { AdminModule } from "../src/admin/admin.module.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { DEMO_USER_HEADER } from "../src/users/demo-user.guard.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("GET /admin/audit-log (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  let admin: string;
  let buyer: string;
  let older: string;
  let newer: string;

  const get = (userId: string | undefined, url: string) =>
    app.inject({
      method: "GET",
      url,
      headers: userId === undefined ? {} : { [DEMO_USER_HEADER]: userId },
    });

  beforeAll(async () => {
    database = await startTestDatabase();
    const orm = database.db.orm.public;
    // These users never sign in.
    const user = (email: string, role: string) =>
      orm.User.select("id")
        .create({ email, passwordHash: "", name: "Test User", role })
        .then((created) => created.id);
    admin = await user("admin@example.test", "admin");
    buyer = await user("buyer@example.test", "buyer");

    const entry = async (action: string, requestId: string) => {
      const created = await orm.AuditLog.select("id").create({
        actorId: buyer,
        action,
        targetType: "address",
        targetId: "1a2b3c4d-0000-4000-8000-000000000001",
        requestId,
      });
      return created.id;
    };
    older = await entry("address.create", "req-1");
    // A few milliseconds apart, so the order is the order of the writes.
    await new Promise((resolve) => setTimeout(resolve, 20));
    newer = await entry("address.update", "req-2");

    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  it("pages the log for an admin, newest first", async () => {
    const first = auditPageSchema.parse((await get(admin, "/admin/audit-log?limit=1")).json());
    expect(first.items.map((entry) => entry.id)).toEqual([newer]);
    expect(first.items[0]).toMatchObject({ actorId: buyer, action: "address.update" });
    expect(first.nextCursor).not.toBeNull();

    const second = auditPageSchema.parse(
      (await get(admin, `/admin/audit-log?limit=1&cursor=${first.nextCursor}`)).json(),
    );
    expect(second.items.map((entry) => entry.id)).toEqual([older]);
    expect(second.nextCursor).toBeNull();
  });

  it("answers 403 problem+json to a buyer", async () => {
    const response = await get(buyer, "/admin/audit-log");

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("answers 401 without the demo header", async () => {
    const response = await get(undefined, "/admin/audit-log");

    expect(response.statusCode).toBe(401);
  });
});
