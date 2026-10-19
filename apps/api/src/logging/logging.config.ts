import { randomUUID } from "node:crypto";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { DestinationStream } from "pino";
import type { Params } from "nestjs-pino";

export const REQUEST_ID_HEADER = "x-request-id";
export const REDACTED = "[Redacted]";

const SENSITIVE_FIELDS = ["password", "token", "email"];

// Headers are blanked by exact path. Sensitive fields are blanked at the top level and up to
// three levels deep, since fast-redact wildcards match one level each.
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  ...SENSITIVE_FIELDS.flatMap((field) => [field, `*.${field}`, `*.*.${field}`, `*.*.*.${field}`]),
];

// Fastify assigns the request ID before pino-http runs, so the ID is set up on the adapter. It
// reuses the caller's x-request-id header and makes a new ID when there is none.
export const fastifyOptions = {
  requestIdHeader: REQUEST_ID_HEADER,
  genReqId: () => randomUUID(),
};

// Sends the ID back so a caller can quote it when reporting a problem.
export function echoRequestId(app: NestFastifyApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRequest", (req, reply, done) => {
      void reply.header(REQUEST_ID_HEADER, req.id);
      done();
    });
}

export function loggingParams(stream?: DestinationStream): Params {
  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: { paths: REDACT_PATHS, censor: REDACTED },
      ...(stream ? { stream } : {}),
    },
  };
}
