import { SignJWT, UnsecuredJWT } from "jose";
import {
  ACCESS_TOKEN_SECONDS,
  CHALLENGE_PURPOSE,
  CHALLENGE_SECONDS,
  hashToken,
  TokensService,
} from "./tokens.service.js";

const USER = { id: "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d", role: "customer" };
const MINUTE = 60_000;

describe("TokensService", () => {
  const tokens = new TokensService();

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs an access token that verifies, with the user as sub and their role", async () => {
    const payload = await tokens.verifyAccess(await tokens.signAccess(USER));

    expect(payload).toMatchObject({ sub: USER.id, role: "customer" });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(ACCESS_TOKEN_SECONDS);
  });

  it("names the session in sid when given one, and leaves it out otherwise", async () => {
    const family = "0f1e2d3c-4b5a-4968-8776-655443322110";

    expect(await tokens.verifyAccess(await tokens.signAccess(USER, family))).toMatchObject({
      sid: family,
    });
    expect((await tokens.verifyAccess(await tokens.signAccess(USER)))["sid"]).toBeUndefined();
  });

  it("rejects an access token after 15 minutes", async () => {
    const token = await tokens.signAccess(USER);

    await expect(tokens.verifyAccess(token, new Date(Date.now() + 16 * MINUTE))).rejects.toThrow(
      /exp/,
    );
  });

  it("rejects a token signed with another key", async () => {
    const forged = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER.id)
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("some-other-secret-0123456789abcdef"));

    await expect(tokens.verifyAccess(forged)).rejects.toThrow(/signature/);
  });

  it("rejects an unsigned token (alg: none), whatever it claims", async () => {
    const unsigned = new UnsecuredJWT({ role: "admin" })
      .setSubject(USER.id)
      .setExpirationTime("15m")
      .encode();

    await expect(tokens.verifyAccess(unsigned)).rejects.toThrow();
  });

  it("rejects a token signed with the right secret but another algorithm (HS512)", async () => {
    const otherAlgorithm = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(USER.id)
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(process.env["JWT_SECRET"]));

    await expect(tokens.verifyAccess(otherAlgorithm)).rejects.toThrow(/alg/);
  });

  it("refuses to sign without JWT_SECRET", async () => {
    vi.stubEnv("JWT_SECRET", "");

    await expect(tokens.signAccess(USER)).rejects.toThrow("JWT_SECRET is not set");
  });

  it("makes a 32-byte refresh token whose stored form is its SHA-256 hash", () => {
    const { token, hash } = tokens.newRefresh();

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(tokens.newRefresh().token).not.toBe(token);
  });

  it("makes email tokens the same way", () => {
    const { token, hash } = tokens.newEmailToken();

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(hash).toBe(hashToken(token));
    expect(tokens.newEmailToken().token).not.toBe(token);
  });

  describe("two-step challenges", () => {
    it("signs a 5-minute challenge whose user and id verify", async () => {
      const challenge = await tokens.signChallenge(USER.id);

      const payload = JSON.parse(Buffer.from(challenge.split(".")[1]!, "base64url").toString()) as {
        purpose: string;
        exp: number;
        iat: number;
        jti: string;
        role?: string;
      };
      expect(await tokens.verifyChallenge(challenge)).toEqual({
        userId: USER.id,
        challengeId: payload.jti,
      });
      expect(payload.purpose).toBe(CHALLENGE_PURPOSE);
      expect(payload.exp - payload.iat).toBe(CHALLENGE_SECONDS);
      expect(payload.role).toBeUndefined();
    });

    it("gives every challenge its own id, even two for one user in the same second", async () => {
      const [first, second] = await Promise.all([
        tokens.signChallenge(USER.id),
        tokens.signChallenge(USER.id),
      ]);

      const ids = await Promise.all([first, second].map((c) => tokens.verifyChallenge(c)));
      expect(ids[0]!.challengeId).toMatch(/^[0-9a-f-]{36}$/);
      expect(ids[0]!.challengeId).not.toBe(ids[1]!.challengeId);
    });

    it("names a challenge from before challenges had an id by the token itself", async () => {
      const secret = new TextEncoder().encode(process.env["JWT_SECRET"]);
      const older = await new SignJWT({ purpose: CHALLENGE_PURPOSE })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(USER.id)
        .setExpirationTime("5m")
        .sign(secret);

      expect(await tokens.verifyChallenge(older)).toEqual({ userId: USER.id, challengeId: older });
    });

    it("rejects a challenge after 5 minutes", async () => {
      const challenge = await tokens.signChallenge(USER.id);

      await expect(
        tokens.verifyChallenge(challenge, new Date(Date.now() + 6 * MINUTE)),
      ).rejects.toThrow(/exp/);
    });

    it("never takes a challenge as an access token", async () => {
      const challenge = await tokens.signChallenge(USER.id);

      await expect(tokens.verifyAccess(challenge)).rejects.toThrow("Not an access token");
    });

    it("never takes an access token as a challenge", async () => {
      await expect(tokens.verifyChallenge(await tokens.signAccess(USER))).rejects.toThrow(
        "Not a two-step challenge",
      );
    });

    it("rejects a challenge without a user", async () => {
      const secret = new TextEncoder().encode(process.env["JWT_SECRET"]);
      const noSub = await new SignJWT({ purpose: CHALLENGE_PURPOSE })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("5m")
        .sign(secret);

      await expect(tokens.verifyChallenge(noSub)).rejects.toThrow("Not a two-step challenge");
    });
  });
});
