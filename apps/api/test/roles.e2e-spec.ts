import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ROLES, type Role } from "@manasbal/types";
import { AdminModule } from "../src/admin/admin.module.js";
import { AuditModule } from "../src/audit/audit.module.js";
import { WRONG_ROLE } from "../src/auth/roles.js";
import { CartModule } from "../src/cart/cart.module.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { OrdersModule } from "../src/orders/orders.module.js";
import { UsersModule } from "../src/users/users.module.js";
import { bearer } from "./support/auth.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

// The role matrix: every guarded endpoint against every role, with the real guards and real
// access tokens. To guard a new endpoint, add a row; "any" means every signed-in role.
const MATRIX: { method: "GET"; url: string; allowed: readonly Role[] | "any" }[] = [
  { method: "GET", url: "/me", allowed: "any" },
  { method: "GET", url: "/me/addresses", allowed: "any" },
  { method: "GET", url: "/cart", allowed: "any" },
  { method: "GET", url: "/orders", allowed: "any" },
  { method: "GET", url: "/admin/audit-log", allowed: ["admin"] },
];

const CASES = MATRIX.flatMap(({ method, url, allowed }) => [
  ...ROLES.map((role) => ({
    method,
    url,
    role,
    expected: allowed === "any" || allowed.includes(role) ? 200 : 403,
  })),
  { method, url, role: "no token" as const, expected: 401 },
]);

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("role matrix (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  // One user per role; GET /me reads the user's row.
  const users = new Map<Role, string>();

  beforeAll(async () => {
    database = await startTestDatabase();
    for (const role of ROLES) {
      const created = await database.db.orm.public.User.select("id").create({
        email: `${role}@example.test`,
        passwordHash: "",
        name: "Test User",
        role,
      });
      users.set(role, created.id);
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule, UsersModule, CartModule, OrdersModule, AdminModule],
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

  it.each(CASES)(
    "$method $url as $role answers $expected",
    async ({ method, url, role, expected }) => {
      const headers = role === "no token" ? {} : await bearer(users.get(role)!, role);

      const response = await app.inject({ method, url, headers });

      expect(response.statusCode).toBe(expected);
      if (expected === 403) {
        expect(response.headers["content-type"]).toContain("application/problem+json");
        expect(response.json()).toMatchObject({ status: 403, detail: WRONG_ROLE });
      }
    },
  );

  it("refuses a token with a role that no longer exists on an admin endpoint", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/audit-log",
      headers: await bearer(users.get("admin")!, "buyer" as Role),
    });

    expect(response.statusCode).toBe(403);
  });
});
