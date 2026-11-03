import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Roles, ROLES_KEY, RolesGuard, WRONG_ROLE } from "./roles.js";

class Plain {
  handler() {}
}

@Roles("admin", "support")
class Guarded {
  handler() {}

  @Roles("admin")
  adminOnly() {}
}

function contextFor(target: new () => object, method: string, role?: string) {
  const handler = (target.prototype as Record<string, () => void>)[method]!;
  return {
    getHandler: () => handler,
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => (role === undefined ? {} : { role }) }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector());

  it("stores the roles as metadata", () => {
    expect(Reflect.getMetadata(ROLES_KEY, Guarded)).toEqual(["admin", "support"]);
  });

  it("lets anyone in where no @Roles is set", () => {
    expect(guard.canActivate(contextFor(Plain, "handler", "customer"))).toBe(true);
    expect(guard.canActivate(contextFor(Plain, "handler"))).toBe(true);
  });

  it("lets in a role from the class's @Roles", () => {
    expect(guard.canActivate(contextFor(Guarded, "handler", "support"))).toBe(true);
  });

  it("uses the handler's @Roles over the class's", () => {
    expect(guard.canActivate(contextFor(Guarded, "adminOnly", "admin"))).toBe(true);
    expect(() => guard.canActivate(contextFor(Guarded, "adminOnly", "support"))).toThrow(
      WRONG_ROLE,
    );
  });

  it.each([
    { case: "another role", role: "customer" },
    { case: "a role not in the list", role: "buyer" },
    { case: "no role (AuthGuard did not run)", role: undefined },
  ])("answers 403 to $case", ({ role }) => {
    expect(() => guard.canActivate(contextFor(Guarded, "handler", role))).toThrow(WRONG_ROLE);
  });
});
