import fastifyCookie from "@fastify/cookie";
import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { AuditModule } from "../src/audit/audit.module.js";
import { AuthModule } from "../src/auth/auth.module.js";
import {
  EMAIL_NOT_CONFIRMED,
  LINK_INVALID,
  REFRESH_FAILED,
  SIGN_IN_FAILED,
  SIGN_UP_FAILED,
} from "../src/auth/auth.service.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { fastifyOptions } from "../src/logging/logging.config.js";
import { type Mail, MailerService } from "../src/mail/mailer.service.js";
import { UsersModule } from "../src/users/users.module.js";
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
  // Stands in for SMTP. MAIL_MODE is unset here (off), so it only receives mail in the tests
  // that switch mail on.
  const sent: Mail[] = [];
  const mailer = {
    send: (mail: Mail) => {
      sent.push(mail);
      return Promise.resolve();
    },
  };

  const post = (payload: object) => app.inject({ method: "POST", url: "/auth/sign-up", payload });
  const signIn = (payload: object) =>
    app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload,
      headers: { "user-agent": "Test Browser" },
    });

  beforeAll(async () => {
    database = await startTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule, AuthModule, UsersModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    })
      .overrideProvider(MailerService)
      .useValue(mailer)
      .compile();
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
  });

  beforeEach(async () => {
    await database.sql("delete from refresh_tokens");
    await database.sql("delete from email_tokens");
    await database.sql("delete from users");
    sent.length = 0;
  });

  it("creates a visitor customer and stores only an argon2id hash", async () => {
    const created = await post(signUp);

    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();
    expect(created.json()).toEqual({ id, email: signUp.email, name: signUp.name });

    const hash = await database.sql(`select password_hash from users where id = '${id}'`);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(signUp.password);
    expect(
      await database.sql(`select role || ',' || created_by_visitor from users where id = '${id}'`),
    ).toBe("customer,true");
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

  describe("refresh and sign-out", () => {
    // Signs up and in, and answers the refresh token from the cookie.
    async function session(): Promise<string> {
      expect((await post(signUp)).statusCode).toBe(201);
      return cookieToken(await signIn({ email: signUp.email, password: signUp.password }));
    }

    function cookieToken(answer: { headers: Record<string, unknown> }): string {
      const token = /^refresh_token=([\w-]*);/.exec(String(answer.headers["set-cookie"]))?.[1];
      if (token === undefined) throw new Error("no refresh_token cookie");
      return token;
    }

    const refresh = (token?: string) =>
      app.inject({
        method: "POST",
        url: "/auth/refresh",
        ...(token === undefined ? {} : { cookies: { refresh_token: token } }),
      });

    const signOut = (token: string) =>
      app.inject({ method: "POST", url: "/auth/sign-out", cookies: { refresh_token: token } });

    it("swaps a token for a new access token and a new cookie, once", async () => {
      const first = await session();

      const renewed = await refresh(first);
      expect(renewed.statusCode).toBe(200);
      const body = renewed.json<{ accessToken: unknown; expiresIn: unknown }>();
      expect(typeof body.accessToken).toBe("string");
      expect(body.expiresIn).toBe(900);
      const second = cookieToken(renewed);
      expect(second).not.toBe(first);

      // Both tokens are in one family; the first is marked used.
      expect(
        await database.sql(
          "select count(distinct family_id) || ',' || count(used_at) from refresh_tokens",
        ),
      ).toBe("1,1");
      // The new one works in turn.
      expect((await refresh(second)).statusCode).toBe(200);
    });

    it("refuses the old token once it has been swapped", async () => {
      const first = await session();
      expect((await refresh(first)).statusCode).toBe(200);

      const again = await refresh(first);

      expect(again.statusCode).toBe(401);
      expect(again.json()).toMatchObject({ detail: REFRESH_FAILED });
    });

    it("revokes the whole family when an old token is reused", async () => {
      const first = await session();
      const second = cookieToken(await refresh(first));

      // Someone replays the first token: the newest token stops working too.
      expect((await refresh(first)).statusCode).toBe(401);
      expect((await refresh(second)).statusCode).toBe(401);
      expect(
        await database.sql("select count(*) from refresh_tokens where revoked_at is null"),
      ).toBe("0");
    });

    it("refuses an expired token", async () => {
      const token = await session();
      await database.sql("update refresh_tokens set expires_at = now() - interval '1 second'");

      expect((await refresh(token)).statusCode).toBe(401);
    });

    it("refuses a missing cookie and a made-up token", async () => {
      expect((await refresh()).statusCode).toBe(401);
      expect((await refresh("made-up-token")).statusCode).toBe(401);
    });

    it("signs out: revokes the token and clears the cookie", async () => {
      const token = await session();

      const out = await signOut(token);

      expect(out.statusCode).toBe(204);
      const cleared = String(out.headers["set-cookie"]);
      expect(cleared).toMatch(/^refresh_token=;/);
      expect(cleared).toContain("Path=/auth");
      expect(cleared).toContain("Expires=Thu, 01 Jan 1970");
      // A revoked token refuses to refresh.
      expect((await refresh(token)).statusCode).toBe(401);
    });
  });

  it("with mail off, confirms the account at sign-up and sends nothing", async () => {
    expect((await post(signUp)).statusCode).toBe(201);

    expect(await database.sql("select email_verified_at is not null from users")).toBe("t");
    expect(await database.sql("select count(*) from email_tokens")).toBe("0");
    expect(sent).toEqual([]);
  });

  describe("with mail on", () => {
    const verify = (token: string) =>
      app.inject({ method: "POST", url: "/auth/verify-email", payload: { token } });
    const linkToken = (mail: Mail | undefined) =>
      /token=([\w-]+)/.exec(mail?.text ?? "")?.[1] ?? "";

    beforeEach(() => {
      vi.stubEnv("MAIL_MODE", "smtp");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("mails a link, refuses sign-in until it is used, then lets the account in", async () => {
      expect((await post(signUp)).statusCode).toBe(201);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.to).toBe(signUp.email);
      expect(sent[0]?.text).toContain("Use made-up details. This is a demo.");
      const token = linkToken(sent[0]);
      expect(token).toMatch(/^[\w-]{43}$/);

      // Only the hash is stored.
      const stored = await database.sql("select token_hash || ',' || purpose from email_tokens");
      expect(stored).toMatch(/^[0-9a-f]{64},verify-email$/);
      expect(stored).not.toContain(token);

      const early = await signIn({ email: signUp.email, password: signUp.password });
      expect(early.statusCode).toBe(403);
      expect(early.json()).toMatchObject({ detail: EMAIL_NOT_CONFIRMED });

      expect((await verify(token)).statusCode).toBe(204);
      expect(await database.sql("select email_verified_at is not null from users")).toBe("t");
      expect(await database.sql("select used_at is not null from email_tokens")).toBe("t");

      const later = await signIn({ email: signUp.email, password: signUp.password });
      expect(later.statusCode).toBe(200);
    });

    it("never says whether the account is confirmed to a wrong password", async () => {
      expect((await post(signUp)).statusCode).toBe(201);

      const answer = await signIn({ email: signUp.email, password: "not the password" });

      expect(answer.statusCode).toBe(401);
      expect(answer.json()).toMatchObject({ detail: SIGN_IN_FAILED });
    });

    it("gives a used, an expired and a made-up link the same 400", async () => {
      expect((await post(signUp)).statusCode).toBe(201);
      const token = linkToken(sent[0]);
      expect((await verify(token)).statusCode).toBe(204);

      const used = await verify(token);
      const madeUp = await verify("not-a-real-token");
      await database.sql("delete from email_tokens");
      await database.sql("delete from users");
      expect((await post(signUp)).statusCode).toBe(201);
      await database.sql("update email_tokens set expires_at = now() - interval '1 minute'");
      const expired = await verify(linkToken(sent[1]));

      for (const answer of [used, madeUp, expired]) {
        expect(answer.statusCode).toBe(400);
        expect(answer.json()).toMatchObject({ detail: LINK_INVALID });
      }
    });

    it("sends no mail for a taken email", async () => {
      expect((await post(signUp)).statusCode).toBe(201);

      const again = await post(signUp);

      expect(again.statusCode).toBe(400);
      expect(again.json()).toMatchObject({ detail: SIGN_UP_FAILED });
      expect(sent).toHaveLength(1);
    });

    describe("password reset", () => {
      const newPassword = "a brand new passphrase";
      const forgot = (email: string) =>
        app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email } });
      const reset = (token: string, password = newPassword) =>
        app.inject({ method: "POST", url: "/auth/reset-password", payload: { token, password } });
      const refreshWith = (token: string) =>
        app.inject({ method: "POST", url: "/auth/refresh", cookies: { refresh_token: token } });

      // Signs up, confirms and signs in; answers the refresh token from the cookie.
      async function signedIn(): Promise<string> {
        expect((await post(signUp)).statusCode).toBe(201);
        expect((await verify(linkToken(sent[0]))).statusCode).toBe(204);
        const answer = await signIn({ email: signUp.email, password: signUp.password });
        expect(answer.statusCode).toBe(200);
        return /^refresh_token=([\w-]+);/.exec(String(answer.headers["set-cookie"]))?.[1] ?? "";
      }

      it("mails a link, changes the password, and ends every session", async () => {
        const refreshToken = await signedIn();

        const known = await forgot(signUp.email);
        const unknown = await forgot("nobody@example.test");

        // Both answers look the same.
        for (const answer of [known, unknown]) {
          expect(answer.statusCode).toBe(202);
          expect(answer.body).toBe("");
        }
        // The mail goes out after the answer; only the account gets one.
        await vi.waitFor(() => expect(sent).toHaveLength(2));
        const mail = sent[1];
        expect(mail?.to).toBe(signUp.email);
        expect(mail?.text).toContain("/reset-password?token=");
        expect(mail?.text).toContain("If you didn't ask for this, ignore this mail.");
        expect(sent.map((m) => m.to)).not.toContain("nobody@example.test");
        const stored = await database.sql(
          "select purpose || ',' || (expires_at - created_at < interval '61 minutes') from email_tokens where purpose = 'reset-password'",
        );
        expect(stored).toBe("reset-password,true");

        const token = linkToken(mail);
        expect((await reset(token)).statusCode).toBe(204);

        const oldPassword = await signIn({ email: signUp.email, password: signUp.password });
        expect(oldPassword.statusCode).toBe(401);
        const fresh = await signIn({ email: signUp.email, password: newPassword });
        expect(fresh.statusCode).toBe(200);
        // All sessions end: the cookie from before the reset no longer works.
        const oldSession = await refreshWith(refreshToken);
        expect(oldSession.statusCode).toBe(401);
        expect(oldSession.json()).toMatchObject({ detail: REFRESH_FAILED });

        // A reused token fails.
        const again = await reset(token, "yet another passphrase");
        expect(again.statusCode).toBe(400);
        expect(again.json()).toMatchObject({ detail: LINK_INVALID });
      });

      it("uses up every older reset link when one is used", async () => {
        await signedIn();
        expect((await forgot(signUp.email)).statusCode).toBe(202);
        expect((await forgot(signUp.email)).statusCode).toBe(202);
        await vi.waitFor(() => expect(sent).toHaveLength(3));

        expect((await reset(linkToken(sent[2]))).statusCode).toBe(204);

        const older = await reset(linkToken(sent[1]), "yet another passphrase");
        expect(older.statusCode).toBe(400);
      });

      it("refuses an expired or made-up link, and a weak password", async () => {
        await signedIn();
        expect((await forgot(signUp.email)).statusCode).toBe(202);
        await vi.waitFor(() => expect(sent).toHaveLength(2));
        const token = linkToken(sent[1]);

        const weak = await reset(token, "too short");
        expect(weak.statusCode).toBe(400);
        expect(JSON.stringify(weak.json())).toContain("Use at least 12 characters");

        expect((await reset("not-a-real-token")).statusCode).toBe(400);
        await database.sql(
          "update email_tokens set expires_at = now() - interval '1 minute' where purpose = 'reset-password'",
        );
        const expired = await reset(token);
        expect(expired.statusCode).toBe(400);
        expect(expired.json()).toMatchObject({ detail: LINK_INVALID });
      });
    });
  });

  describe("GET /me", () => {
    it("answers the signed-in user's name, email and role for their access token", async () => {
      expect((await post(signUp)).statusCode).toBe(201);
      const signedIn = await signIn({ email: signUp.email, password: signUp.password });
      const { accessToken } = signedIn.json<{ accessToken: string }>();

      const me = await app.inject({
        method: "GET",
        url: "/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual({
        id: expect.any(String) as string,
        name: signUp.name,
        email: signUp.email,
        role: "customer",
      });
    });

    it("answers 401 without a token, or with a made-up one", async () => {
      expect((await app.inject({ method: "GET", url: "/me" })).statusCode).toBe(401);
      const forged = await app.inject({
        method: "GET",
        url: "/me",
        headers: { authorization: "Bearer not.a.token" },
      });
      expect(forged.statusCode).toBe(401);
    });
  });
});
