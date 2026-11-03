import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { JWTPayload } from "jose";
import type { AuthedRequest } from "./current-user.js";
import { TokensService } from "./tokens.service.js";

export const SIGN_IN_REQUIRED = "Sign in to do this";

const BEARER = /^Bearer (\S+)$/;

// Lets in a request that carries a valid access token in `Authorization: Bearer <token>`, and
// puts the user's id and role on it. The token is checked without a database lookup (ADR 0011):
// its signature and 15-minute expiry are enough.
@Injectable()
export class AuthGuard implements CanActivate {
  // Typed as the part it uses: a class type makes the decorator metadata emit a branch that never
  // runs. @Inject still names the provider.
  constructor(
    @Inject(TokensService) private readonly tokens: Pick<TokensService, "verifyAccess">,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = BEARER.exec(request.headers.authorization ?? "")?.[1];
    if (token === undefined) throw new UnauthorizedException(SIGN_IN_REQUIRED);

    // A token that does not verify reads as one with no claims, so it is refused below.
    const payload = await this.tokens.verifyAccess(token).catch((): JWTPayload => ({}));
    const { sub, role, sid } = payload;
    if (typeof sub !== "string" || typeof role !== "string") {
      throw new UnauthorizedException(SIGN_IN_REQUIRED);
    }

    request.userId = sub;
    request.role = role;
    // The session the token was issued for; older tokens carry none.
    if (typeof sid === "string") request.sessionId = sid;
    return true;
  }
}
