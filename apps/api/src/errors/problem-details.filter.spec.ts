import { BadRequestException, Controller, Get, Logger, NotFoundException } from "@nestjs/common";
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
