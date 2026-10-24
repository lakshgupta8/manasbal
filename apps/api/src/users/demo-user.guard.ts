import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { getDb } from "../prisma/db.js";

export const DEMO_USER_HEADER = "x-demo-user";

interface DemoUserRequest extends FastifyRequest {
  userId?: string;
}

const userIdSchema = z.uuid();

// A stand-in for sign-in until real accounts exist: outside production the caller names the
// user it acts as in the x-demo-user header. Production has no such shortcut, so there every
// request is refused before the header is even read.
@Injectable()
export class DemoUserGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Sign-in is not available yet");
    }

    const request = context.switchToHttp().getRequest<DemoUserRequest>();
    const parsed = userIdSchema.safeParse(request.headers[DEMO_USER_HEADER]);
    if (!parsed.success) {
      throw new UnauthorizedException(`Send a user id in the ${DEMO_USER_HEADER} header`);
    }

    const user = await getDb().orm.public.User.where({ id: parsed.data }).select("id").first();
    if (user === null) throw new UnauthorizedException("No user has this id");

    request.userId = user.id;
    return true;
  }
}

// The id of the user DemoUserGuard let in.
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<DemoUserRequest>().userId!,
);

// Who made the request, for the audit log: the user DemoUserGuard let in and the request's ID.
export interface Actor {
  userId: string;
  requestId: string;
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context.switchToHttp().getRequest<DemoUserRequest>();
    return { userId: request.userId!, requestId: String(request.id) };
  },
);
