import { STATUS_CODES } from "node:http";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

// RFC 7807 body. `type` is "about:blank" because the title is just the HTTP status phrase.
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId: string;
}

function detailOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === "string") return body;
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join("; ");
  return typeof message === "string" ? message : exception.message;
}

// Turns every error into a problem document. Unexpected errors are logged in full but only
// reported as a generic 500, so internals never reach the caller.
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const known = exception instanceof HttpException;
    const status = known ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!known) this.logger.error(exception instanceof Error ? exception.stack : exception);

    const problem: ProblemDetails = {
      type: "about:blank",
      title: STATUS_CODES[status] ?? "Error",
      status,
      detail: known ? detailOf(exception) : "Something went wrong on our side.",
      requestId: String(request.id),
    };

    void reply.status(status).header("content-type", PROBLEM_CONTENT_TYPE).send(problem);
  }
}
