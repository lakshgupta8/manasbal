import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

describe("test database helper", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await startTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await database.stop();
  });

  it("starts a Postgres with the migrations applied", async () => {
    const count = await database.sql(
      "select count(*) from information_schema.tables where table_schema = 'public'",
    );

    expect(Number(count)).toBeGreaterThan(0);
  });

  it("points the Prisma client at the throwaway database", () => {
    expect(process.env["DATABASE_URL"]).toBe(database.url);
    expect(database.db).toBeDefined();
  });
});
