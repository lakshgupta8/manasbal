import { createHash } from "node:crypto";
import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { catchError, from, mergeMap, of, throwError, type Observable } from "rxjs";
import { IdempotencyStore, type IdempotencyRecord } from "./idempotency.store.js";

export const IDEMPOTENCY_HEADER = "idempotency-key";
export const REPLAYED_HEADER = "idempotent-replayed";
const MAX_KEY_LENGTH = 255;
type Store = Pick<IdempotencyStore, "claim" | "complete" | "release">;
// Reads are safe to repeat anyway, so only requests that change something use keys.
const CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// The same key must come with the same request; anything else is a client bug.
function fingerprintOf(request: FastifyRequest): string {
  return createHash("sha256")
    .update(`${request.method} ${request.url}\n${JSON.stringify(request.body ?? null)}`)
    .digest("hex");
}

// When a changing request carries an Idempotency-Key, the first answer is kept in Valkey for
// 24 hours and sent again for every repeat, instead of doing the work twice.
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  // Injected by token and typed by its methods: a class type here would make the compiler
  // emit a never-taken "is the class defined?" check for the decorator metadata.
  constructor(@Inject(IdempotencyStore) private readonly store: Store) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const key = request.headers[IDEMPOTENCY_HEADER];

    if (key === undefined || !CHANGING_METHODS.has(request.method)) return next.handle();
    if (typeof key !== "string" || key.length === 0 || key.length > MAX_KEY_LENGTH) {
      throw new BadRequestException(`Idempotency-Key must be 1 to ${MAX_KEY_LENGTH} characters`);
    }

    const fingerprint = fingerprintOf(request);
    return from(this.claim(key, fingerprint)).pipe(
      mergeMap((existing) => {
        if (existing === null) return this.run(key, fingerprint, reply, next);
        if (existing.fingerprint !== fingerprint) {
          throw new UnprocessableEntityException(
            "This Idempotency-Key was already used for a different request",
          );
        }
        if (existing.response === undefined) {
          throw new ConflictException("A request with this Idempotency-Key is still running");
        }
        reply.status(existing.response.status).header(REPLAYED_HEADER, "true");
        return of(existing.response.body);
      }),
    );
  }

  // The client asked not to have the work done twice; without Valkey that can't be promised,
  // so refuse rather than risk it.
  private async claim(key: string, fingerprint: string): Promise<IdempotencyRecord | null> {
    try {
      return await this.store.claim(key, fingerprint);
    } catch (error) {
      this.logger.error(`Idempotency store unavailable: ${String(error)}`);
      throw new ServiceUnavailableException(
        "Idempotency-Key can't be honoured right now; retry later",
      );
    }
  }

  private run(
    key: string,
    fingerprint: string,
    reply: FastifyReply,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        await this.store.complete(key, fingerprint, { status: reply.statusCode, body });
        return body;
      }),
      catchError((error: unknown) =>
        from(this.store.release(key).catch(() => undefined)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}
