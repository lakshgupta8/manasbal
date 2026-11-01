import { AuthController } from "./auth.controller.js";

describe("AuthController", () => {
  it("passes the sign-up input to the service and answers its result", async () => {
    const input = {
      email: "test.buyer@example.test",
      password: "a long passphrase",
      name: "Test Buyer",
      confirmAdult: true as const,
    };
    const created = {
      id: "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d",
      email: input.email,
      name: input.name,
    };
    const service = { signUp: vi.fn().mockResolvedValue(created) };
    const controller = new AuthController(service);

    await expect(controller.signUp(input)).resolves.toBe(created);
    expect(service.signUp).toHaveBeenCalledWith(input);
  });
});
