import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { DEMO_USER_HEADER } from "../src/users/demo-user.guard.js";
import { UsersModule } from "../src/users/users.module.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

const address = {
  name: "Test Buyer",
  line1: "12 Sample Lane",
  city: "Sampleton",
  state: "Example State",
  pincode: "190006",
  phone: "9800000000",
};

// Needs Docker: a throwaway Postgres with the migrations applied.
describe("/me/addresses (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  let userA: string;
  let userB: string;

  const as = (
    userId: string,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: object,
  ) => app.inject({ method, url, payload, headers: { [DEMO_USER_HEADER]: userId } });

  async function createUser(email: string): Promise<string> {
    const user = await database.db.orm.public.User.select("id").create({
      email,
      // These users never sign in.
      passwordHash: "",
      name: "Test User",
    });
    return user.id;
  }

  beforeAll(async () => {
    database = await startTestDatabase();
    userA = await createUser("user-a@example.test");
    userB = await createUser("user-b@example.test");

    const moduleRef = await Test.createTestingModule({
      imports: [UsersModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await database.stop();
  });

  beforeEach(async () => {
    await database.sql("delete from orders");
    await database.sql("delete from addresses");
  });

  it("adds, lists, edits and deletes the user's own address", async () => {
    const created = await as(userA, "POST", "/me/addresses", address);
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();
    expect(created.json()).toEqual({ id, ...address, isDefault: false });

    const list = await as(userA, "GET", "/me/addresses");
    expect(list.json()).toEqual([{ id, ...address, isDefault: false }]);

    const edited = await as(userA, "PATCH", `/me/addresses/${id}`, { city: "Othertown" });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ id, city: "Othertown", name: address.name });

    expect((await as(userA, "DELETE", `/me/addresses/${id}`)).statusCode).toBe(204);
    expect((await as(userA, "GET", "/me/addresses")).json()).toEqual([]);
  });

  it("gives user B a 404 for user A's address and leaves it alone", async () => {
    const { id } = (await as(userA, "POST", "/me/addresses", address)).json<{ id: string }>();

    const edit = await as(userB, "PATCH", `/me/addresses/${id}`, { city: "Othertown" });
    const remove = await as(userB, "DELETE", `/me/addresses/${id}`);

    expect(edit.statusCode).toBe(404);
    expect(remove.statusCode).toBe(404);
    expect(edit.headers["content-type"]).toContain("application/problem+json");
    expect((await as(userB, "GET", "/me/addresses")).json()).toEqual([]);
    expect((await as(userA, "GET", "/me/addresses")).json()).toEqual([
      { id, ...address, isDefault: false },
    ]);
  });

  it("keeps one default address per user, listed first", async () => {
    const home = (
      await as(userA, "POST", "/me/addresses", { ...address, name: "Home", isDefault: true })
    ).json<{ id: string }>();
    const work = (await as(userA, "POST", "/me/addresses", { ...address, name: "Work" })).json<{
      id: string;
    }>();
    const other = (await as(userB, "POST", "/me/addresses", { ...address, isDefault: true })).json<{
      id: string;
    }>();

    await as(userA, "PATCH", `/me/addresses/${work.id}`, { isDefault: true });

    const list = (await as(userA, "GET", "/me/addresses")).json<
      { id: string; isDefault: boolean }[]
    >();
    expect(list.map((a) => [a.id, a.isDefault])).toEqual([
      [work.id, true],
      [home.id, false],
    ]);
    // Another user's default is not touched.
    expect((await as(userB, "GET", "/me/addresses")).json()).toEqual([
      expect.objectContaining({ id: other.id, isDefault: true }),
    ]);
  });

  it("keeps an address an order was sent to", async () => {
    const { id } = (await as(userA, "POST", "/me/addresses", address)).json<{ id: string }>();
    await database.db.orm.public.Order.select("id").create({
      userId: userA,
      addressId: id,
      status: "placed",
      totalPaise: 49_900,
      idempotencyKey: "addresses-e2e-order",
    });

    const response = await as(userA, "DELETE", `/me/addresses/${id}`);

    expect(response.statusCode).toBe(409);
  });

  it("refuses a body that doesn't fit, with the field named", async () => {
    const response = await as(userA, "POST", "/me/addresses", { ...address, pincode: "12" });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ detail: string }>().detail).toBe("pincode: Enter a 6-digit PIN code");
  });

  it("refuses a user that doesn't exist", async () => {
    const response = await as("00000000-0000-4000-8000-000000000000", "GET", "/me/addresses");

    expect(response.statusCode).toBe(401);
  });
});
