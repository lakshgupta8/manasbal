import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { DEMO_USER_HEADER, DemoUserGuard } from "./demo-user.guard.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";

// The guard only asks the database whether the user exists.
const first = vi.fn<() => Promise<{ id: string } | null>>();
vi.mock("../prisma/db.js", () => ({
  getDb: () => ({
    orm: { public: { User: { where: () => ({ select: () => ({ first }) }) } } },
  }),
}));

function contextFor(headers: Record<string, string>) {
  const request: { headers: Record<string, string>; userId?: string } = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("DemoUserGuard", () => {
  const guard = new DemoUserGuard();

  beforeEach(() => {
    first.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets a known user in and remembers who it is", async () => {
    first.mockResolvedValue({ id: USER_ID });
    const { context, request } = contextFor({ [DEMO_USER_HEADER]: USER_ID });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.userId).toBe(USER_ID);
  });

  it("refuses a request without the header", async () => {
    await expect(guard.canActivate(contextFor({}).context)).rejects.toThrow(UnauthorizedException);
  });

  it("refuses a header that isn't a user id", async () => {
    const { context } = contextFor({ [DEMO_USER_HEADER]: "1 OR 1=1" });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(first).not.toHaveBeenCalled();
  });

  it("refuses an id no user has", async () => {
    first.mockResolvedValue(null);
    const { context } = contextFor({ [DEMO_USER_HEADER]: USER_ID });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("refuses everyone in production, without reading the header", async () => {
    vi.stubEnv("NODE_ENV", "production");
    first.mockResolvedValue({ id: USER_ID });
    const { context } = contextFor({ [DEMO_USER_HEADER]: USER_ID });

    await expect(guard.canActivate(context)).rejects.toThrow("Sign-in is not available yet");
    expect(first).not.toHaveBeenCalled();
  });
});
