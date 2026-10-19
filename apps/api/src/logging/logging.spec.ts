import { Controller, Get, Logger as NestLogger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger, LoggerModule } from "nestjs-pino";
import pino from "pino";
import { Writable } from "node:stream";
import {
  echoRequestId,
  fastifyOptions,
  loggingParams,
  REDACT_PATHS,
  REDACTED,
  REQUEST_ID_HEADER,
} from "./logging.config.js";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(...chunk.toString().split("\n").filter(Boolean));
      done();
    },
  });
  return { lines, stream };
}

@Controller("ping")
class PingController {
  private readonly logger = new NestLogger("PingController");

  @Get()
  ping() {
    this.logger.log("handling ping");
    return { ok: true };
  }
}

describe("redaction", () => {
  it("keeps an email and a password out of the log output", () => {
    const { lines, stream } = capture();
    const logger = pino({ redact: { paths: REDACT_PATHS, censor: REDACTED } }, stream);

    logger.info(
      { email: "asha@example.com", password: "hunter2-secret", user: { token: "tok_123" } },
      "signup",
    );

    const output = lines.join("\n");
    expect(output).not.toContain("asha@example.com");
    expect(output).not.toContain("hunter2-secret");
    expect(output).not.toContain("tok_123");
    expect(output).toContain(REDACTED);
  });

  it("blanks the authorization and cookie headers", () => {
    const { lines, stream } = capture();
    const logger = pino({ redact: { paths: REDACT_PATHS, censor: REDACTED } }, stream);

    logger.info(
      { req: { headers: { authorization: "Bearer abc", cookie: "sid=xyz" } } },
      "request",
    );

    const output = lines.join("\n");
    expect(output).not.toContain("Bearer abc");
    expect(output).not.toContain("sid=xyz");
  });
});

describe("request IDs", () => {
  let app: NestFastifyApplication;
  let lines: string[];

  beforeEach(async () => {
    const sink = capture();
    lines = sink.lines;
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(loggingParams(sink.stream))],
      controllers: [PingController],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(fastifyOptions),
    );
    app.useLogger(app.get(Logger));
    echoRequestId(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // Startup lines come from no request, so only lines carrying a req belong to the call.
  const requestLines = () =>
    lines.map((line) => JSON.parse(line) as { req?: { id?: string } }).filter((line) => line.req);

  const idsOf = () => requestLines().map((line) => line.req?.id);

  it("reuses the x-request-id header in every log line for the request", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { [REQUEST_ID_HEADER]: "abc-123", authorization: "Bearer secret-token" },
    });

    expect(response.headers[REQUEST_ID_HEADER]).toBe("abc-123");
    expect(requestLines().length).toBeGreaterThanOrEqual(2);
    expect(idsOf().every((id) => id === "abc-123")).toBe(true);
    expect(lines.join("\n")).not.toContain("secret-token");
  });

  it("makes a new ID when the header is missing", async () => {
    const response = await app.inject({ method: "GET", url: "/ping" });

    const id = response.headers[REQUEST_ID_HEADER];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(idsOf().every((logged) => logged === id)).toBe(true);
  });
});
