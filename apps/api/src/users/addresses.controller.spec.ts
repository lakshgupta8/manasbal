import type { ExecutionContext } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { InjectOptions } from "fastify";
import { AuditModule } from "../audit/audit.module.js";
import { fastifyOptions, REQUEST_ID_HEADER } from "../logging/logging.config.js";
import { ProblemDetailsFilter } from "../errors/problem-details.filter.js";
import { AddressesService } from "./addresses.service.js";
import { DEMO_USER_HEADER, DemoUserGuard } from "./demo-user.guard.js";
import { UsersModule } from "./users.module.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const REQUEST_ID = "test-req-1";
// What CurrentActor hands the service: the signed-in user and the request's id.
const ACTOR = { userId: USER_ID, requestId: REQUEST_ID };
const ADDRESS_ID = "0f1e2d3c-4b5a-4968-8776-655443322110";

// Every endpoint, called the way a client that knows the demo header would call it.
const requests: InjectOptions[] = [
  { method: "GET", url: "/me/addresses" },
  {
    method: "POST",
    url: "/me/addresses",
    payload: {
      name: "Test Buyer",
      line1: "12 Sample Lane",
      city: "Sampleton",
      state: "Example State",
      pincode: "190006",
    },
  },
  { method: "PATCH", url: `/me/addresses/${ADDRESS_ID}`, payload: { city: "Othertown" } },
  { method: "DELETE", url: `/me/addresses/${ADDRESS_ID}` },
];

// The ownership rules need a real database and live in test/addresses.e2e-spec.ts. This one
// needs none: in production the guard refuses before anything is looked up.
describe("AddressesController in production", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule, UsersModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(requests)("$method $url answers 401", async (request) => {
    const response = await app.inject({ ...request, headers: { [DEMO_USER_HEADER]: USER_ID } });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });
});

// The controller's own part: each endpoint hands the signed-in user's id and the parsed body
// to the service, and answers with the right status.
describe("AddressesController", () => {
  let app: NestFastifyApplication;
  const service = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [UsersModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    })
      .overrideProvider(AddressesService)
      .useValue(service)
      .overrideGuard(DemoUserGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<{ userId?: string }>().userId = USER_ID;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(fastifyOptions),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the user's addresses", async () => {
    service.list.mockResolvedValue([]);

    const response = await app.inject(requests[0]!);

    expect(response.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalledWith(USER_ID);
  });

  it("creates an address from the parsed body", async () => {
    service.create.mockResolvedValue({ id: ADDRESS_ID });

    const response = await app.inject({
      ...requests[1]!,
      headers: { [REQUEST_ID_HEADER]: REQUEST_ID },
    });

    expect(response.statusCode).toBe(201);
    expect(service.create).toHaveBeenCalledWith(ACTOR, requests[1]!.payload);
  });

  it("edits an address", async () => {
    service.update.mockResolvedValue({ id: ADDRESS_ID });

    const response = await app.inject({
      ...requests[2]!,
      headers: { [REQUEST_ID_HEADER]: REQUEST_ID },
    });

    expect(response.statusCode).toBe(200);
    expect(service.update).toHaveBeenCalledWith(ACTOR, ADDRESS_ID, { city: "Othertown" });
  });

  it("deletes an address with no body in the answer", async () => {
    service.remove.mockResolvedValue(undefined);

    const response = await app.inject({
      ...requests[3]!,
      headers: { [REQUEST_ID_HEADER]: REQUEST_ID },
    });

    expect(response.statusCode).toBe(204);
    expect(service.remove).toHaveBeenCalledWith(ACTOR, ADDRESS_ID);
  });

  it("answers 400 for an id that isn't a uuid, without asking the service", async () => {
    const response = await app.inject({ method: "DELETE", url: "/me/addresses/not-an-id" });

    expect(response.statusCode).toBe(400);
    expect(service.remove).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that doesn't fit, without asking the service", async () => {
    const response = await app.inject({ method: "POST", url: "/me/addresses", payload: {} });

    expect(response.statusCode).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });
});
