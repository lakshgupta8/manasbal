import fastifyCookie from "@fastify/cookie";
import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { AuthModule } from "../src/auth/auth.module.js";
import { SIGN_IN_FAILED, SIGN_UP_FAILED } from "../src/auth/auth.service.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { fastifyOptions } from "../src/logging/logging.config.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";

const signUp = {
  email: "test.buyer@example.test",
  password: "a long passphrase",
  name: "Test Buyer",
  confirmAdult: true,
};

// Needs Docker: a throwaway Postgres with the migrations applied. RateLimitModule is not loaded,
// so the /auth limit of 10 a minute does not apply here.
describe("/auth (e2e)", () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;

  const post = (payload: object) => app.inject({ method: "POST", url: "/auth/sign-up", payload });
  const signIn = (payload: object) =>
    app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload,
      headers: { "user-agent": "Test Browser" },
    });

  beforeAll(async () => {
    vi.stubEnv("JWT_SECRET", "test-only-secret-0123456789abcdef");
    database = await startTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(fastifyOptions),
    );
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await database.stop();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await database.sql("delete from refresh_tokens");
    await database.sql("delete from users");
  });

  it("creates a visitor buyer and stores only an argon2id hash", async () => {
    const created = await post(signUp);

    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();
    expect(created.json()).toEqual({ id, email: signUp.email, name: signUp.name });

    const hash = await database.sql(`select password_hash from users where id = '${id}'`);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(signUp.password);
    expect(
      await database.sql(`select role || ',' || created_by_visitor from users where id = '${id}'`),
    ).toBe("buyer,true");
  });

  it("refuses a weak password", async () => {
    const answer = await post({ ...signUp, password: "short" });

    expect(answer.statusCode).toBe(400);
  });

  it("refuses a sign-up without the 18+ confirmation", async () => {
    const answer = await post({ ...signUp, confirmAdult: undefined });

    expect(answer.statusCode).toBe(400);
  });

  it("gives the generic answer for a taken email", async () => {
    expect((await post(signUp)).statusCode).toBe(201);

    const again = await post({ ...signUp, name: "Someone Else" });

    expect(again.statusCode).toBe(400);
    expect(again.json()).toMatchObject({ detail: SIGN_UP_FAILED });
    expect(await database.sql("select count(*) from users")).toBe("1");
  });

  it("treats the same email in other capitals as taken", async () => {
    expect((await post(signUp)).statusCode).toBe(201);

    const again = await post({ ...signUp, email: "Test.Buyer@Example.TEST" });

    expect(again.statusCode).toBe(400);
    expect(again.json()).toMatchObject({ detail: SIGN_UP_FAILED });
  });

  it("signs in with an access token and an httpOnly refresh cookie", async () => {
    expect((await post(signUp)).statusCode).toBe(201);

    const answer = await signIn({ email: signUp.email, password: signUp.password });

    expect(answer.statusCode).toBe(200);
    const body = answer.json<{ accessToken: unknown; expiresIn: unknown }>();
    expect(typeof body.accessToken).toBe("string");
    expect(body.expiresIn).toBe(900);
    const cookie = String(answer.headers["set-cookie"]);
    expect(cookie).toMatch(/^refresh_token=[\w-]{43};/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/auth");
    expect(cookie).toContain("SameSite=Lax");

    // Only the token's SHA-256 hash is stored, with the browser it came from.
    const token = /^refresh_token=([\w-]+);/.exec(cookie)?.[1];
    const row = await database.sql(
      "select token_hash || ',' || user_agent || ',' || created_by_visitor from refresh_tokens",
    );
    const [tokenHash, userAgent, byVisitor] = row.split(",");
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toBe(token);
    expect(userAgent).toBe("Test Browser");
    expect(byVisitor).toBe("true");
  });

  it("gives a wrong password and an unknown email the same 401", async () => {
    expect((await post(signUp)).statusCode).toBe(201);

    const wrongPassword = await signIn({ email: signUp.email, password: "not the password" });
    const unknownEmail = await signIn({ email: "nobody@example.test", password: signUp.password });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json()).toMatchObject({ detail: SIGN_IN_FAILED });
    // The problem document carries the request's own id and path; everything else must match.
    const strip = (body: Record<string, unknown>) => ({ ...body, instance: "", requestId: "" });
    expect(strip(unknownEmail.json())).toEqual(strip(wrongPassword.json()));
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
    expect(await database.sql("select count(*) from refresh_tokens")).toBe("0");
  });
});
