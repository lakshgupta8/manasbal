import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { REFRESH_COOKIE } from "./cookie.js";
import { webOrigins } from "./web-origins.js";

export const ORIGIN_REFUSED = "This request must come from the Manasbal shop";

// Guards the routes that act on the refresh cookie (refresh, sign-out), so another site can't
// make a visitor's browser use it (CSRF). A request with an Origin header must come from
// WEB_ORIGINS. Browsers always send Origin on a cross-site POST, so a request without one is not
// a browser being tricked: it is let through only when it carries no refresh cookie (a script
// or server with nothing to steal, which then gets the route's usual 401 or 204).
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed = new Set(webOrigins());

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Pick<FastifyRequest, "headers"> & Partial<Pick<FastifyRequest, "cookies">>>();
    const origin = request.headers.origin;
    const allowed =
      origin === undefined
        ? request.cookies?.[REFRESH_COOKIE] === undefined
        : this.allowed.has(origin);
    if (!allowed) throw new ForbiddenException(ORIGIN_REFUSED);
    return true;
  }
}
