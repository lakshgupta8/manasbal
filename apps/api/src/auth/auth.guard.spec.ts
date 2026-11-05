import type { ExecutionContext } from "@nestjs/common";
import { SignJWT, UnsecuredJWT } from "jose";
import { AuthGuard, SIGN_IN_REQUIRED } from "./auth.guard.js";
import type { AuthedRequest } from "./current-user.js";
import { TokensService } from "./tokens.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const SECRET = new TextEncoder().encode("test-only-secret-0123456789abcdef");

function contextFor(authorization?: string) {
  const request = {
    headers: authorization === undefined ? {} : { authorization },
  } as Partial<AuthedRequest> as AuthedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

// A token signed with the test key, with whatever claims a case needs.
function sign(claims: Record<string, unknown>, sub?: string) {
  const jwt = new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setExpirationTime("15m");
  if (sub !== undefined) jwt.setSubject(sub);
  return jwt.sign(SECRET);
}

describe("AuthGuard", () => {
  const tokens = new TokensService();
  const guard = new AuthGuard(tokens);

  it("lets in a valid token and puts the user's id and role on the request", async () => {
    const token = await tokens.signAccess({ id: USER_ID, role: "admin" });
    const { context, request } = contextFor(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.userId).toBe(USER_ID);
    expect(request.role).toBe("admin");
    // No session in an older token.
    expect(request.sessionId).toBeUndefined();
  });

  it("puts the token's session on the request", async () => {
    const family = "0f1e2d3c-4b5a-4968-8776-655443322110";
    const token = await tokens.signAccess({ id: USER_ID, role: "customer" }, family);
    const { context, request } = contextFor(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.sessionId).toBe(family);
  });

  it.each([
    { case: "no Authorization header", header: undefined },
    { case: "another scheme", header: "Basic dXNlcjpwYXNz" },
    { case: "Bearer with no token", header: "Bearer " },
    { case: "a token that is not a JWT", header: "Bearer not-a-jwt" },
  ])("refuses $case", async ({ header }) => {
    await expect(guard.canActivate(contextFor(header).context)).rejects.toThrow(SIGN_IN_REQUIRED);
  });

  it("refuses an expired token", async () => {
    const token = await tokens.signAccess({ id: USER_ID, role: "customer" });
    // Checked 16 minutes from now, past the token's 15-minute life.
    const later = new Date(Date.now() + 16 * 60_000);
    const checking = new AuthGuard({ verifyAccess: (t) => tokens.verifyAccess(t, later) });

    await expect(checking.canActivate(contextFor(`Bearer ${token}`).context)).rejects.toThrow(
      SIGN_IN_REQUIRED,
    );
  });

  it("refuses a token signed with another key", async () => {
    const forged = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("some-other-secret-0123456789abcdef"));

    await expect(guard.canActivate(contextFor(`Bearer ${forged}`).context)).rejects.toThrow(
      SIGN_IN_REQUIRED,
    );
  });

  it("refuses a token with another algorithm: unsigned (alg: none) or HS512 with our secret", async () => {
    const unsigned = new UnsecuredJWT({ role: "admin" })
      .setSubject(USER_ID)
      .setExpirationTime("15m")
      .encode();
    const otherAlgorithm = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(USER_ID)
      .setExpirationTime("15m")
      .sign(SECRET);

    for (const token of [unsigned, otherAlgorithm]) {
      const { context, request } = contextFor(`Bearer ${token}`);
      await expect(guard.canActivate(context)).rejects.toThrow(SIGN_IN_REQUIRED);
      expect(request.userId).toBeUndefined();
    }
  });

  it("refuses a token without a role or without a subject", async () => {
    const noRole = await sign({}, USER_ID);
    const noSub = await sign({ role: "customer" });

    for (const token of [noRole, noSub]) {
      const { context, request } = contextFor(`Bearer ${token}`);
      await expect(guard.canActivate(context)).rejects.toThrow(SIGN_IN_REQUIRED);
      expect(request.userId).toBeUndefined();
    }
  });
});
