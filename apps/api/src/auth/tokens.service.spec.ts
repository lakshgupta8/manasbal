import { SignJWT } from "jose";
import { ACCESS_TOKEN_SECONDS, hashRefresh, TokensService } from "./tokens.service.js";

const USER = { id: "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d", role: "buyer" };
const MINUTE = 60_000;

describe("TokensService", () => {
  const tokens = new TokensService();

  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-only-secret-0123456789abcdef");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs an access token that verifies, with the user as sub and their role", async () => {
    const payload = await tokens.verifyAccess(await tokens.signAccess(USER));

    expect(payload).toMatchObject({ sub: USER.id, role: "buyer" });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(ACCESS_TOKEN_SECONDS);
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

  it("refuses to sign without JWT_SECRET", async () => {
    vi.stubEnv("JWT_SECRET", "");

    await expect(tokens.signAccess(USER)).rejects.toThrow("JWT_SECRET is not set");
  });

  it("makes a 32-byte refresh token whose stored form is its SHA-256 hash", () => {
    const { token, hash } = tokens.newRefresh();

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(hash).toBe(hashRefresh(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(tokens.newRefresh().token).not.toBe(token);
  });
});
