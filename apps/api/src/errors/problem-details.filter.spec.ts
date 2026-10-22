import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { echoRequestId, fastifyOptions, REQUEST_ID_HEADER } from "../logging/logging.config.js";
import {
  PROBLEM_CONTENT_TYPE,
  type ProblemDetails,
  ProblemDetailsFilter,
} from "./problem-details.filter.js";

@Controller("boom")
class BoomController {
  @Get("missing")
  missing() {
    throw new NotFoundException("No such product");
  }

  @Get("invalid")
  invalid() {
    throw new BadRequestException(["name must not be empty", "price must be a whole number"]);
  }

  @Get("text")
  text() {
    throw new HttpException("plain text reason", 409);
  }

  @Get("object")
  object() {
    throw new HttpException({ error: "no message field" }, 422);
  }

  @Get("odd-status")
  oddStatus() {
    throw new HttpException("custom status", 499);
  }

  @Get("thrown-string")
  thrownString() {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw "not an Error object";
  }

  @Get("crash")
  crash() {
    throw new Error("database password is hunter2");
  }
}

describe("ProblemDetailsFilter", () => {
  let app: NestFastifyApplication;

  beforeAll(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(fastifyOptions),
    );
    echoRequestId(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns a known error as a problem document with the request ID", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/boom/missing",
      headers: { [REQUEST_ID_HEADER]: "req-42" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "No such product",
      requestId: "req-42",
    });
  });

  it("joins a list of validation messages into the detail", async () => {
    const response = await app.inject({ method: "GET", url: "/boom/invalid" });

    expect(response.statusCode).toBe(400);
    expect(response.json<ProblemDetails>().detail).toBe(
      "name must not be empty; price must be a whole number",
    );
  });

  it("uses a plain string body as the detail", async () => {
    const response = await app.inject({ method: "GET", url: "/boom/text" });

    expect(response.json()).toMatchObject({ status: 409, detail: "plain text reason" });
  });

  it("falls back to the exception message when the body has no message", async () => {
    const response = await app.inject({ method: "GET", url: "/boom/object" });

    expect(response.json<ProblemDetails>().detail).toBe("Http Exception");
  });

  it("uses a generic title for a status without a standard phrase", async () => {
    const response = await app.inject({ method: "GET", url: "/boom/odd-status" });

    expect(response.json()).toMatchObject({ status: 499, title: "Error" });
  });

  it("handles a thrown value that is not an Error", async () => {
    const response = await app.inject({ method: "GET", url: "/boom/thrown-string" });

    expect(response.statusCode).toBe(500);
  });

  it("hides the message of an unexpected error", async () => {
    const response = await app.inject({ method: "GET", url: "/boom/crash" });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
    expect(response.body).not.toContain("hunter2");
    expect(response.json()).toMatchObject({ title: "Internal Server Error", status: 500 });
  });

  it("answers an unknown route as a problem document too", async () => {
    const response = await app.inject({ method: "GET", url: "/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
  });
});
