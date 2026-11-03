import { open, seal } from "./secret-box.js";

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 8);
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

describe("seal and open", () => {
  it("round-trips, and the stored text never contains the secret", () => {
    const sealed = seal(SECRET, KEY);

    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sealed).not.toContain(SECRET);
    expect(open(sealed, KEY)).toBe(SECRET);
  });

  it("uses a fresh IV, so the same secret seals differently each time", () => {
    expect(seal(SECRET, KEY)).not.toBe(seal(SECRET, KEY));
  });

  it("fails on another key or a changed text instead of giving a wrong secret", () => {
    const sealed = seal(SECRET, KEY);
    const parts = sealed.split(".");
    const changed = [...parts.slice(0, 3), Buffer.from("tampered").toString("base64url")].join(".");

    expect(() => open(sealed, OTHER_KEY)).toThrow();
    expect(() => open(changed, KEY)).toThrow();
  });

  it.each(["v2.a.b.c", "v1.a.b", "plain-secret"])("refuses %j as not sealed", (text) => {
    expect(() => open(text, KEY)).toThrow("Not a sealed secret");
  });

  it("uses TOTP_KEY by default", () => {
    expect(open(seal(SECRET))).toBe(SECRET);
  });
});
