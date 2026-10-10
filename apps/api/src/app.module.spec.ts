import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module.js";
import { HealthController } from "./health/health.controller.js";

describe("AppModule", () => {
  it("compiles and wires the health controller", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(HealthController)).toBeInstanceOf(HealthController);
  });
});
