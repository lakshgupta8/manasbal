import fastifyCookie from "@fastify/cookie";
import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { SignJWT } from "jose";
import { sessionListSchema } from "@manasbal/types";
import type { Redis } from "ioredis";
import { generate } from "otplib";
import { AuditModule } from "../src/audit/audit.module.js";
import { AuthModule } from "../src/auth/auth.module.js";
import {
  EMAIL_NOT_CONFIRMED,
  LINK_INVALID,
  REFRESH_FAILED,
  SIGN_IN_FAILED,
  SIGN_UP_FAILED,
} from "../src/auth/auth.service.js";
import { hashRecoveryCode } from "../src/auth/recovery-codes.js";
import { open } from "../src/auth/secret-box.js";
import { REFRESH_COOKIE } from "../src/auth/cookie.js";
import { LOCKED_OUT, LOCKOUT_LIMIT } from "../src/auth/lockout.service.js";
import { ORIGIN_REFUSED } from "../src/auth/origin.guard.js";
import { CHALLENGE_PURPOSE } from "../src/auth/tokens.service.js";
import {
  SIGN_IN_AGAIN,
  TWO_STEP_ALREADY_ON,
  TWO_STEP_OFF,
  WRONG_CODE,
} from "../src/auth/two-step.service.js";
import { ProblemDetailsFilter } from "../src/errors/problem-details.filter.js";
import { fastifyOptions } from "../src/logging/logging.config.js";
import { type Mail, MailerService } from "../src/mail/mailer.service.js";
import { NO_SESSION } from "../src/users/sessions.service.js";
import { UsersModule } from "../src/users/users.module.js";
import { VALKEY } from "../src/valkey/valkey.module.js";
import { startTestDatabase, type TestDatabase } from "./support/test-database.js";
import { startTestValkey, type TestValkey } from "./support/test-valkey.js";

// The shop's origin (WEB_ORIGINS in the e2e config): the refresh cookie routes check it.
const SHOP = { origin: "http://localhost:3000" };

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
  let valkey: TestValkey;
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

  // Every audit row as one text, to show no email or password is ever stored.
  const auditText = () =>
    database.sql(
      "select coalesce(string_agg(row_to_json(audit_logs)::text, ''), '') from audit_logs",
    );
  const auditActions = () =>
    database.sql("select string_agg(action, ',' order by created_at, action) from audit_logs");

  beforeAll(async () => {
    // A throwaway Valkey holds the lockout counts, as in production.
    [database, valkey] = await Promise.all([startTestDatabase(), startTestValkey()]);

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
    await valkey.stop();
  });

  beforeEach(async () => {
    await database.sql("delete from refresh_tokens");
    await database.sql("delete from email_tokens");
    await database.sql("delete from recovery_codes");
    await database.sql("delete from audit_logs");
    await database.sql("delete from users");
    await app.get<Redis>(VALKEY).flushall();
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
        headers: SHOP,
        ...(token === undefined ? {} : { cookies: { refresh_token: token } }),
      });

    const signOut = (token: string) =>
      app.inject({
        method: "POST",
        url: "/auth/sign-out",
        headers: SHOP,
        cookies: { refresh_token: token },
      });

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
      expect(await auditActions()).toBe("auth.sign_up,auth.sign_in,auth.refresh.reuse");
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
      expect(await auditActions()).toBe("auth.sign_up,auth.sign_in,auth.sign_out");
    });

    it("refuses the cookie routes from another site, or with the cookie and no Origin", async () => {
      const token = await session();
      const call = (url: string, headers: Record<string, string>, cookie = true) =>
        app.inject({
          method: "POST",
          url,
          headers,
          ...(cookie ? { cookies: { refresh_token: token } } : {}),
        });

      for (const url of ["/auth/refresh", "/auth/sign-out"]) {
        for (const refused of [
          await call(url, { origin: "https://evil.example" }),
          await call(url, {}),
        ]) {
          expect(refused.statusCode).toBe(403);
          expect(refused.json()).toMatchObject({ detail: ORIGIN_REFUSED });
          expect(refused.headers["set-cookie"]).toBeUndefined();
        }
      }
      // No cookie and no Origin: nothing to protect, so the usual answers.
      expect((await call("/auth/refresh", {}, false)).statusCode).toBe(401);
      expect((await call("/auth/sign-out", {}, false)).statusCode).toBe(204);
      // The session survived every refused try.
      expect((await refresh(token)).statusCode).toBe(200);
    });

    it("leaves the other auth routes open to any origin", async () => {
      expect((await post(signUp)).statusCode).toBe(201);

      const answer = await app.inject({
        method: "POST",
        url: "/auth/sign-in",
        headers: { origin: "https://evil.example" },
        payload: { email: signUp.email, password: signUp.password },
      });

      expect(answer.statusCode).toBe(200);
    });
  });

  describe("lockout", () => {
    const wrong = (email = signUp.email) => signIn({ email, password: "not the password" });
    const right = () => signIn({ email: signUp.email, password: signUp.password });

    it("locks an email after 5 wrong passwords: the sixth try answers 429, even a right one", async () => {
      expect((await post(signUp)).statusCode).toBe(201);
      const userId = await database.sql("select id from users");

      for (let i = 1; i <= LOCKOUT_LIMIT; i++) expect((await wrong()).statusCode).toBe(401);
      const sixth = await wrong();
      const rightButLocked = await right();

      for (const locked of [sixth, rightButLocked]) {
        expect(locked.statusCode).toBe(429);
        expect(locked.headers["content-type"]).toContain("application/problem+json");
        expect(locked.json()).toMatchObject({ status: 429, detail: LOCKED_OUT });
        expect(Number(locked.headers["retry-after"])).toBeGreaterThan(890);
        expect(locked.headers["set-cookie"]).toBeUndefined();
      }

      // Valkey holds one key, named by the email's hash, that expires by itself.
      const valkeyClient = app.get<Redis>(VALKEY);
      const keys = await valkeyClient.keys("lockout:*");
      expect(keys).toHaveLength(1);
      expect(keys[0]).toMatch(/^lockout:email:[0-9a-f]{64}$/);
      const ttl = await valkeyClient.pttl(keys[0]!);
      expect(ttl).toBeGreaterThan(890_000);
      expect(ttl).toBeLessThanOrEqual(15 * 60_000);

      expect(await auditActions()).toBe(
        `auth.sign_up${",auth.sign_in.failed".repeat(LOCKOUT_LIMIT)},auth.lockout`,
      );
      expect(
        await database.sql(
          "select count(distinct actor_id) || ',' || min(actor_id::text) from audit_logs",
        ),
      ).toBe(`1,${userId}`);
      expect(await auditText()).not.toContain(signUp.email);
      expect(await auditText()).not.toContain("not the password");
    });

    it("counts an unknown email the same way, recorded with no actor and no target", async () => {
      const nobody = "nobody@example.test";

      for (let i = 1; i <= LOCKOUT_LIMIT; i++) expect((await wrong(nobody)).statusCode).toBe(401);

      expect((await wrong(nobody)).statusCode).toBe(429);
      expect(
        await database.sql(
          "select count(*) from audit_logs where actor_id is null and target_type is null and target_id is null",
        ),
      ).toBe(String(LOCKOUT_LIMIT + 1));
      expect(await auditText()).not.toContain(nobody);
    });

    it("starts the count again after a right password", async () => {
      expect((await post(signUp)).statusCode).toBe(201);

      for (let i = 1; i < LOCKOUT_LIMIT; i++) await wrong();
      expect((await right()).statusCode).toBe(200);
      for (let i = 1; i < LOCKOUT_LIMIT; i++) expect((await wrong()).statusCode).toBe(401);

      expect((await right()).statusCode).toBe(200);
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
      await database.sql("delete from audit_logs");
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
        app.inject({
          method: "POST",
          url: "/auth/refresh",
          headers: SHOP,
          cookies: { refresh_token: token },
        });

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

        expect(await auditActions()).toBe(
          [
            "auth.sign_up,auth.email.verify,auth.sign_in",
            "auth.password_reset.request,auth.password_reset.complete",
            "auth.sign_in.failed,auth.sign_in",
          ].join(","),
        );
        expect(await auditText()).not.toContain(signUp.email);
        expect(await auditText()).not.toContain(newPassword);
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

  describe("two-step set-up", () => {
    const post2fa = (path: "setup" | "enable", token?: string, payload?: object) =>
      app.inject({
        method: "POST",
        url: `/auth/2fa/${path}`,
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
        ...(payload === undefined ? {} : { payload }),
      });

    async function signedIn(): Promise<string> {
      expect((await post(signUp)).statusCode).toBe(201);
      const answer = await signIn({ email: signUp.email, password: signUp.password });
      return answer.json<{ accessToken: string }>().accessToken;
    }

    it("sets up with an encrypted secret, enables with an app code, and stores hashed codes", async () => {
      const token = await signedIn();

      const setup = await post2fa("setup", token);
      expect(setup.statusCode).toBe(200);
      const { secret, otpauthUrl } = setup.json<{ secret: string; otpauthUrl: string }>();
      expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\/Manasbal:/);
      expect(otpauthUrl).toContain("issuer=Manasbal");

      // The column holds ciphertext that decrypts back to the secret, never the secret itself.
      const stored = await database.sql("select totp_secret from users");
      expect(stored).not.toContain(secret);
      expect(open(stored)).toBe(secret);
      expect(await database.sql("select totp_enabled_at is null from users")).toBe("t");

      // A wrong code switches nothing on.
      const right = await generate({ secret });
      const wrong = await post2fa("enable", token, {
        code: right === "000000" ? "111111" : "000000",
      });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json()).toMatchObject({ detail: WRONG_CODE });
      expect(await database.sql("select totp_enabled_at is null from users")).toBe("t");

      const enabled = await post2fa("enable", token, { code: await generate({ secret }) });
      expect(enabled.statusCode).toBe(200);
      const { recoveryCodes } = enabled.json<{ recoveryCodes: string[] }>();
      expect(recoveryCodes).toHaveLength(10);
      expect(new Set(recoveryCodes).size).toBe(10);
      expect(await database.sql("select totp_enabled_at is not null from users")).toBe("t");

      const hashes = (await database.sql("select code_hash from recovery_codes"))
        .split("\n")
        .sort();
      expect(hashes).toEqual(recoveryCodes.map(hashRecoveryCode).sort());
      for (const code of recoveryCodes) expect(hashes.join()).not.toContain(code);
      expect(
        await database.sql("select string_agg(action, ',' order by action) from audit_logs"),
      ).toBe("auth.2fa.enable,auth.2fa.setup,auth.sign_in,auth.sign_up");

      // Once on, set-up and enable both answer 409.
      for (const again of [
        await post2fa("setup", token),
        await post2fa("enable", token, { code: await generate({ secret }) }),
      ]) {
        expect(again.statusCode).toBe(409);
        expect(again.json()).toMatchObject({ detail: TWO_STEP_ALREADY_ON });
      }
    });

    it("answers 401 without an access token", async () => {
      expect((await post2fa("setup")).statusCode).toBe(401);
      expect((await post2fa("enable", undefined, { code: "123456" })).statusCode).toBe(401);
    });
  });

  describe("two-step sign-in", () => {
    const credentials = { email: signUp.email, password: signUp.password };
    const bearerHeader = (token: string) => ({ authorization: `Bearer ${token}` });
    const verify = (challengeToken: string, code: string) =>
      app.inject({
        method: "POST",
        url: "/auth/2fa/verify",
        payload: { challengeToken, code },
        headers: { "user-agent": "Test Browser" },
      });
    const challenge = async () => {
      const answer = await signIn(credentials);
      expect(answer.statusCode).toBe(200);
      expect(answer.headers["set-cookie"]).toBeUndefined();
      const body = answer.json<{ twoFactorRequired: boolean; challengeToken: string }>();
      expect(body).toEqual({
        twoFactorRequired: true,
        challengeToken: expect.any(String) as string,
      });
      return body.challengeToken;
    };
    const actions = () =>
      database.sql("select string_agg(action, ',' order by created_at, action) from audit_logs");

    // Signs up, switches two-step on, and answers what the user's phone and paper hold.
    async function withTwoStep() {
      expect((await post(signUp)).statusCode).toBe(201);
      const first = await signIn(credentials);
      // Without two-step, sign-in is unchanged: tokens and the cookie at once.
      expect(first.statusCode).toBe(200);
      expect(first.json()).toEqual({ accessToken: expect.any(String) as string, expiresIn: 900 });
      expect(String(first.headers["set-cookie"])).toContain(`${REFRESH_COOKIE}=`);
      const token = first.json<{ accessToken: string }>().accessToken;

      const setup = await app.inject({
        method: "POST",
        url: "/auth/2fa/setup",
        headers: bearerHeader(token),
      });
      const { secret } = setup.json<{ secret: string }>();
      const enableCode = await generate({ secret });
      const enabled = await app.inject({
        method: "POST",
        url: "/auth/2fa/enable",
        headers: bearerHeader(token),
        payload: { code: enableCode },
      });
      expect(enabled.statusCode).toBe(200);
      const { recoveryCodes } = enabled.json<{ recoveryCodes: string[] }>();
      return { token, secret, enableCode, recoveryCodes };
    }

    it("asks for the code after the password, and lets each code in only once", async () => {
      const { secret, enableCode, recoveryCodes } = await withTwoStep();

      // A wrong code, and the code that switched two-step on, are both refused.
      const right = await generate({ secret });
      for (const code of [right === "000000" ? "111111" : "000000", enableCode]) {
        const refused = await verify(await challenge(), code);
        expect(refused.statusCode).toBe(401);
        expect(refused.json()).toMatchObject({ detail: WRONG_CODE });
        expect(refused.headers["set-cookie"]).toBeUndefined();
      }

      // The next step's code (in the clock tolerance) signs in, exactly as sign-in does.
      const nextCode = await generate({ secret, epoch: Math.floor(Date.now() / 1000) + 30 });
      const signedIn = await verify(await challenge(), nextCode);
      expect(signedIn.statusCode).toBe(200);
      expect(signedIn.json()).toEqual({
        accessToken: expect.any(String) as string,
        expiresIn: 900,
      });
      expect(String(signedIn.headers["set-cookie"])).toContain(`${REFRESH_COOKIE}=`);
      const me = await app.inject({
        method: "GET",
        url: "/me",
        headers: bearerHeader(signedIn.json<{ accessToken: string }>().accessToken),
      });
      expect(me.statusCode).toBe(200);

      // The same code again is a replay.
      const replay = await verify(await challenge(), nextCode);
      expect(replay.statusCode).toBe(401);
      expect(replay.json()).toMatchObject({ detail: WRONG_CODE });

      // A recovery code works once, typed any way; the second use gets the same answer.
      const recovery = recoveryCodes[0]!;
      expect((await verify(await challenge(), recovery.toUpperCase())).statusCode).toBe(200);
      const again = await verify(await challenge(), recovery);
      expect(again.statusCode).toBe(401);
      expect(again.json()).toMatchObject({ detail: WRONG_CODE });
      expect(
        await database.sql("select count(*) from recovery_codes where used_at is not null"),
      ).toBe("1");

      // Every challenge, wrong code and sign-in is recorded, with no email.
      expect(await actions()).toBe(
        [
          "auth.sign_up,auth.sign_in,auth.2fa.setup,auth.2fa.enable",
          "auth.2fa.challenge,auth.2fa.failed,auth.2fa.challenge,auth.2fa.failed",
          "auth.2fa.challenge,auth.2fa.verify",
          "auth.2fa.challenge,auth.2fa.failed",
          "auth.2fa.challenge,auth.2fa.recovery_used,auth.2fa.verify",
          "auth.2fa.challenge,auth.2fa.failed",
        ].join(","),
      );

      // Two verifies racing with one recovery code: only one signs in.
      await database.sql("delete from audit_logs");
      const [a, b] = await Promise.all([
        verify(await challenge(), recoveryCodes[1]!),
        verify(await challenge(), recoveryCodes[1]!),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 401]);
      expect(
        await database.sql("select string_agg(action, ',' order by action) from audit_logs"),
      ).toBe(
        "auth.2fa.challenge,auth.2fa.challenge,auth.2fa.failed,auth.2fa.recovery_used,auth.2fa.verify",
      );
      // One sign-in before two-step, and three through the second step.
      expect(await database.sql("select count(*) from refresh_tokens")).toBe("4");
    });

    it("locks the second step after 5 wrong codes, even for a right code", async () => {
      const { secret } = await withTwoStep();

      for (let i = 1; i <= LOCKOUT_LIMIT; i++) {
        expect((await verify(await challenge(), "000000")).statusCode).toBe(401);
      }
      const locked = await verify(
        await challenge(),
        await generate({ secret, epoch: Math.floor(Date.now() / 1000) + 30 }),
      );

      expect(locked.statusCode).toBe(429);
      expect(locked.json()).toMatchObject({ detail: LOCKED_OUT });
      expect(await app.get<Redis>(VALKEY).keys("lockout:user:*")).toHaveLength(1);
      expect(
        await database.sql("select count(*) from audit_logs where action = 'auth.lockout'"),
      ).toBe("1");
    });

    it("never takes a challenge as an access token, or an access token as a challenge", async () => {
      const { token } = await withTwoStep();
      const challengeToken = await challenge();

      const asAccess = await app.inject({
        method: "GET",
        url: "/me",
        headers: bearerHeader(challengeToken),
      });
      expect(asAccess.statusCode).toBe(401);

      const asChallenge = await verify(token, "123456");
      expect(asChallenge.statusCode).toBe(401);
      expect(asChallenge.json()).toMatchObject({ detail: SIGN_IN_AGAIN });
    });

    it("refuses an expired challenge", async () => {
      const { secret } = await withTwoStep();
      const userId = await database.sql("select id from users");
      const expired = await new SignJWT({ purpose: CHALLENGE_PURPOSE })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
        .sign(new TextEncoder().encode(process.env["JWT_SECRET"]));

      const answer = await verify(expired, await generate({ secret }));

      expect(answer.statusCode).toBe(401);
      expect(answer.json()).toMatchObject({ detail: SIGN_IN_AGAIN });
    });

    it("switches off with a code, after which sign-in needs only the password", async () => {
      const { token, recoveryCodes } = await withTwoStep();
      const disable = (code: string) =>
        app.inject({
          method: "POST",
          url: "/auth/2fa/disable",
          headers: bearerHeader(token),
          payload: { code },
        });

      const wrong = await disable("aaaaa-aaaaa");
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json()).toMatchObject({ detail: WRONG_CODE });

      expect((await disable(recoveryCodes[0]!)).statusCode).toBe(204);
      expect(
        await database.sql(
          "select (totp_secret is null and totp_enabled_at is null and totp_last_step is null)::text from users",
        ),
      ).toBe("true");
      expect(await database.sql("select count(*) from recovery_codes")).toBe("0");
      expect(
        await database.sql("select count(*) from audit_logs where action = 'auth.2fa.disable'"),
      ).toBe("1");

      const again = await disable(recoveryCodes[1]!);
      expect(again.statusCode).toBe(409);
      expect(again.json()).toMatchObject({ detail: TWO_STEP_OFF });

      const plain = await signIn(credentials);
      expect(plain.json()).toEqual({ accessToken: expect.any(String) as string, expiresIn: 900 });
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/auth/2fa/disable",
            payload: { code: "123456" },
          })
        ).statusCode,
      ).toBe(401);
    });
  });

  describe("sessions", () => {
    const FIREFOX =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";
    const CHROME =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

    // Signs in from a browser; answers its access token and refresh cookie.
    async function from(userAgent: string, account = signUp) {
      const answer = await app.inject({
        method: "POST",
        url: "/auth/sign-in",
        headers: { "user-agent": userAgent },
        payload: { email: account.email, password: account.password },
      });
      expect(answer.statusCode).toBe(200);
      const cookie = /^refresh_token=([\w-]+);/.exec(String(answer.headers["set-cookie"]))?.[1];
      return { access: answer.json<{ accessToken: string }>().accessToken, cookie: cookie! };
    }
    const list = (access: string) =>
      app.inject({
        method: "GET",
        url: "/me/sessions",
        headers: { authorization: `Bearer ${access}` },
      });
    const end = (access: string, id: string) =>
      app.inject({
        method: "DELETE",
        url: `/me/sessions/${id}`,
        headers: { authorization: `Bearer ${access}` },
      });
    // A browser sends its user agent with every refresh, as at sign-in.
    const refreshWith = (cookie: string, userAgent = CHROME) =>
      app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: { ...SHOP, "user-agent": userAgent },
        cookies: { refresh_token: cookie },
      });

    it("lists two sign-ins, flags the current one, and ends one of them", async () => {
      expect((await post(signUp)).statusCode).toBe(201);
      const laptop = await from(FIREFOX);
      const phone = await from(CHROME);

      const listed = await list(phone.access);
      expect(listed.statusCode).toBe(200);
      const sessions = sessionListSchema.parse(listed.json());
      expect(sessions.map(({ browser, current }) => ({ browser, current }))).toEqual([
        { browser: "Chrome on Android", current: true },
        { browser: "Firefox on Windows", current: false },
      ]);
      // Never a token, a hash or the raw user agent.
      expect(listed.body).not.toContain(laptop.cookie);
      expect(listed.body).not.toContain("Gecko");

      // The phone ends the laptop's session: its refresh fails, the phone's still works.
      const laptopId = sessions[1]!.id;
      expect((await end(phone.access, laptopId)).statusCode).toBe(204);
      expect((await refreshWith(laptop.cookie, FIREFOX)).statusCode).toBe(401);
      expect((await refreshWith(phone.cookie)).statusCode).toBe(200);
      const after = sessionListSchema.parse((await list(phone.access)).json());
      expect(after.map((session) => session.browser)).toEqual(["Chrome on Android"]);
      expect(
        await database.sql("select count(*) from audit_logs where action = 'auth.session.end'"),
      ).toBe("1");

      // Ending it again, or the current session, follows the same rules.
      expect((await end(phone.access, laptopId)).statusCode).toBe(404);
      expect((await end(phone.access, after[0]!.id)).statusCode).toBe(204);
      expect(sessionListSchema.parse((await list(phone.access)).json())).toEqual([]);
    });

    it("answers 404 for another user's session and leaves it alone", async () => {
      const other = { ...signUp, email: "other.buyer@example.test" };
      expect((await post(signUp)).statusCode).toBe(201);
      expect((await post(other)).statusCode).toBe(201);
      const mine = await from(FIREFOX);
      const theirs = await from(CHROME, other);
      const theirId = sessionListSchema.parse((await list(theirs.access)).json())[0]!.id;

      const answer = await end(mine.access, theirId);

      expect(answer.statusCode).toBe(404);
      expect(answer.json()).toMatchObject({ detail: NO_SESSION });
      expect((await end(mine.access, "00000000-0000-4000-8000-000000000000")).statusCode).toBe(404);
      expect((await end(mine.access, "not-a-uuid")).statusCode).toBe(400);
      expect((await refreshWith(theirs.cookie)).statusCode).toBe(200);
      // Each user sees only their own session.
      expect(sessionListSchema.parse((await list(mine.access)).json())).toHaveLength(1);
    });

    it("leaves out expired sessions, and needs an access token", async () => {
      expect((await post(signUp)).statusCode).toBe(201);
      const { access } = await from(FIREFOX);
      await database.sql("update refresh_tokens set expires_at = now() - interval '1 second'");

      expect(sessionListSchema.parse((await list(access)).json())).toEqual([]);
      expect((await app.inject({ method: "GET", url: "/me/sessions" })).statusCode).toBe(401);
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/me/sessions/00000000-0000-4000-8000-000000000000",
          })
        ).statusCode,
      ).toBe(401);
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
