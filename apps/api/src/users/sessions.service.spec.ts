import { NotFoundException } from "@nestjs/common";
import { NO_SESSION, SessionsService } from "./sessions.service.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
const FAMILY_A = "0f1e2d3c-4b5a-4968-8776-655443322110";
const FAMILY_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const WHO = { userId: USER_ID, requestId: "req-1" };
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";

// A stand-in for the RefreshToken collection: where() records its filters.
function fakeCollection() {
  const collection = {
    filters: [] as object[],
    where(filter: object) {
      collection.filters.push(filter);
      return collection;
    },
    select: () => collection,
    all: vi.fn<() => Promise<unknown[]>>(),
    first: vi.fn<() => Promise<unknown>>(),
    updateAndCount: vi.fn<(patch: object) => Promise<number>>(),
  };
  return collection;
}

let RefreshToken = fakeCollection();

vi.mock("../prisma/db.js", () => ({
  getDb: () => ({
    orm: { public: { RefreshToken } },
    transaction: (work: (tx: object) => Promise<unknown>) =>
      work({ orm: { public: { RefreshToken } } }),
  }),
}));

const at = (iso: string) => Temporal.Instant.from(iso);
const future = () => Temporal.Now.instant().add({ hours: 24 });

// One stored refresh token: unused, unrevoked and unexpired unless a case says otherwise.
const token = (familyId: string, createdAt: string, overrides: object = {}) => ({
  familyId,
  createdAt: at(createdAt),
  usedAt: null,
  revokedAt: null,
  expiresAt: future(),
  userAgent: FIREFOX,
  ...overrides,
});

describe("SessionsService", () => {
  const audit = { record: vi.fn<() => Promise<void>>() };
  const service = new SessionsService(audit);

  beforeEach(() => {
    RefreshToken = fakeCollection();
    audit.record.mockReset().mockResolvedValue(undefined);
  });

  describe("list", () => {
    it("answers one entry per live family, newest use first, flagging the current one", async () => {
      RefreshToken.all.mockResolvedValue([
        // Family A: signed in at 09:00 (in Firefox), refreshed at 11:00.
        token(FAMILY_A, "2026-11-03T11:00:00Z"),
        token(FAMILY_A, "2026-11-03T09:00:00Z", { usedAt: at("2026-11-03T10:00:00Z") }),
        token(FAMILY_A, "2026-11-03T10:00:00Z", { usedAt: at("2026-11-03T11:00:00Z") }),
        // Family B: signed in at 10:00 with no user agent, never refreshed.
        token(FAMILY_B, "2026-11-03T10:00:00Z", { userAgent: null }),
      ]);

      await expect(service.list(USER_ID, FAMILY_B)).resolves.toEqual([
        {
          id: FAMILY_A,
          browser: "Firefox on Windows",
          startedAt: "2026-11-03T09:00:00Z",
          lastUsedAt: "2026-11-03T11:00:00Z",
          current: false,
        },
        {
          id: FAMILY_B,
          browser: "Unknown browser",
          startedAt: "2026-11-03T10:00:00Z",
          lastUsedAt: "2026-11-03T10:00:00Z",
          current: true,
        },
      ]);
      expect(RefreshToken.filters).toEqual([{ userId: USER_ID }]);
    });

    it("leaves out revoked and expired families", async () => {
      RefreshToken.all.mockResolvedValue([
        token(FAMILY_A, "2026-11-03T09:00:00Z", { revokedAt: at("2026-11-03T09:30:00Z") }),
        token(FAMILY_B, "2026-11-03T10:00:00Z", { expiresAt: at("2026-11-01T00:00:00Z") }),
      ]);

      await expect(service.list(USER_ID, undefined)).resolves.toEqual([]);
    });

    it("flags none as current for an access token from before sessions were named", async () => {
      RefreshToken.all.mockResolvedValue([token(FAMILY_A, "2026-11-03T09:00:00Z")]);

      const [only] = await service.list(USER_ID, undefined);

      expect(only?.current).toBe(false);
    });
  });

  describe("end", () => {
    it("revokes the whole family and audits it with no email or browser", async () => {
      RefreshToken.first.mockResolvedValue({ id: "row-1" });
      RefreshToken.updateAndCount.mockResolvedValue(2);

      await expect(service.end(WHO, FAMILY_A)).resolves.toBeUndefined();

      expect(RefreshToken.filters).toEqual([
        { familyId: FAMILY_A, userId: USER_ID, revokedAt: null },
        { familyId: FAMILY_A, revokedAt: null },
      ]);
      const patch = RefreshToken.updateAndCount.mock.calls[0]?.[0] as { revokedAt: unknown };
      expect(patch.revokedAt).toBeInstanceOf(Temporal.Instant);
      expect(audit.record).toHaveBeenCalledWith(
        WHO,
        "auth.session.end",
        { type: "session", id: FAMILY_A },
        { public: { RefreshToken } },
      );
    });

    it("answers 404 for another user's, an ended or an unknown session, and revokes nothing", async () => {
      RefreshToken.first.mockResolvedValue(null);

      await expect(service.end(WHO, FAMILY_A)).rejects.toThrow(new NotFoundException(NO_SESSION));
      expect(RefreshToken.updateAndCount).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
