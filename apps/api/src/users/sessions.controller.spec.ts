import { SessionsController } from "./sessions.controller.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const FAMILY = "0f1e2d3c-4b5a-4968-8776-655443322110";

describe("SessionsController", () => {
  const service = { list: vi.fn(), end: vi.fn() };
  const controller = new SessionsController(service);

  it("lists the user's sessions, telling which one this token belongs to", async () => {
    service.list.mockResolvedValue([]);

    await expect(controller.list({ userId: USER_ID, sessionId: FAMILY })).resolves.toEqual([]);
    expect(service.list).toHaveBeenCalledWith(USER_ID, FAMILY);
  });

  it("ends a session as the signed-in user, with the request id", async () => {
    service.end.mockResolvedValue(undefined);

    await expect(controller.end({ userId: USER_ID, id: "req-1" }, FAMILY)).resolves.toBeUndefined();
    expect(service.end).toHaveBeenCalledWith({ userId: USER_ID, requestId: "req-1" }, FAMILY);
  });
});
