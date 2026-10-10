import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports the service as healthy", () => {
    expect(controller.check()).toMatchObject({ status: "ok", service: "manasbal-api" });
  });

  it("reports the deployed version", () => {
    vi.stubEnv("APP_VERSION", "abc1234");

    expect(controller.check().version).toBe("abc1234");
  });

  it("falls back to 'dev' outside a built image", () => {
    vi.stubEnv("APP_VERSION", undefined);

    expect(controller.check().version).toBe("dev");
  });
});
