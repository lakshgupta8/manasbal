import { TwoStepController } from "./two-step.controller.js";

describe("TwoStepController", () => {
  const service = { setup: vi.fn(), enable: vi.fn() };
  const controller = new TwoStepController(service);
  const who = { userId: "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d", requestId: "req-1" };

  it("starts set-up for the signed-in user", async () => {
    const started = { otpauthUrl: "otpauth://totp/x", secret: "JBSWY3DP" };
    service.setup.mockResolvedValue(started);

    await expect(controller.setup(who)).resolves.toBe(started);
    expect(service.setup).toHaveBeenCalledWith(who);
  });

  it("passes the code to enable", async () => {
    const enabled = { recoveryCodes: ["abcde-fghjk"] };
    service.enable.mockResolvedValue(enabled);

    await expect(controller.enable(who, { code: "123456" })).resolves.toBe(enabled);
    expect(service.enable).toHaveBeenCalledWith(who, "123456");
  });
});
