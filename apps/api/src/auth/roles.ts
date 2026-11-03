import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { roleSchema, type Role } from "@manasbal/types";
import type { AuthedRequest } from "./current-user.js";

export const ROLES_KEY = "roles";

// The one answer when a signed-in user's role may not use an endpoint.
export const WRONG_ROLE = "You can't do this with your role";

// Which roles may use a handler, or every handler of a controller. Use with
// @UseGuards(AuthGuard, RolesGuard).
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// Lets a request in when its role is one of the @Roles on the handler or its class; without
// @Roles it lets everyone in. The role comes from the access token, which AuthGuard has already
// checked: no database lookup (ADR 0011), so after a role change the old role can last until the
// token expires, up to 15 minutes. A role that is not in the list (such as an old "buyer" token),
// or no role at all because AuthGuard did not run, gets 403.
@Injectable()
export class RolesGuard implements CanActivate {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(
    @Inject(Reflector) private readonly reflector: Pick<Reflector, "getAllAndOverride">,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed === undefined) return true;
    const role = roleSchema.safeParse(context.switchToHttp().getRequest<AuthedRequest>().role);
    if (!role.success || !allowed.includes(role.data)) throw new ForbiddenException(WRONG_ROLE);
    return true;
  }
}
