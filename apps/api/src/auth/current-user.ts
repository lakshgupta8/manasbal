import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

// A request AuthGuard let in: the user id and role come from the access token.
export interface AuthedRequest extends FastifyRequest {
  userId?: string;
  role?: string;
  // The refresh-token family the access token was issued for, when it says.
  sessionId?: string;
}

// The id of the user AuthGuard let in.
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<AuthedRequest>().userId!,
);

// Who made the request, for the audit log: the user AuthGuard let in and the request's ID.
export interface Actor {
  userId: string;
  requestId: string;
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    return { userId: request.userId!, requestId: String(request.id) };
  },
);
