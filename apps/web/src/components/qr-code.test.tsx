import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { modulesPath, QrCode, QUIET_ZONE } from "./qr-code";

afterEach(() => {
  vi.doUnmock("lean-qr/nano");
  vi.resetModules();
});

// Made up: not a key anyone uses.
const LINK = "otpauth://totp/Manasbal:test%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Manasbal";

describe("modulesPath", () => {
  it("draws one square per dark module, inside the quiet zone", () => {
    const path = modulesPath(2, (x, y) => x === y);

    expect(path).toBe(
      `M${QUIET_ZONE} ${QUIET_ZONE}h1v1h-1zM${QUIET_ZONE + 1} ${QUIET_ZONE + 1}h1v1h-1z`,
    );
  });
});

describe("QrCode", () => {
  it("is an image with a name, drawn once the encoder has loaded", async () => {
    render(<QrCode text={LINK} label="QR code for your app" />);
    const image = screen.getByRole("img", { name: "QR code for your app" });
    expect(image.querySelector("path")).toBeNull();

    const path = await waitFor(() => {
      const drawn = image.querySelector("path");
      expect(drawn).not.toBeNull();
      return drawn!;
    });
    expect(path.getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
    // A version 4 code or larger, plus the quiet zone on both sides.
    const size = Number(image.getAttribute("viewBox")!.split(" ")[2]);
    expect(size).toBeGreaterThanOrEqual(33 + QUIET_ZONE * 2);
    // White tile, dark modules, in either theme.
    expect(image.getAttribute("class")).toContain("bg-base-white");
  });

  it("keeps the tile empty when the encoder can't load", async () => {
    vi.resetModules();
    vi.doMock("lean-qr/nano", () => {
      throw new Error("chunk failed to load");
    });
    const { QrCode: Fresh } = await import("./qr-code");
    const loading = vi.spyOn(console, "error");
    render(<Fresh text={LINK} label="QR code" />);

    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(loading).not.toHaveBeenCalled();

    expect(screen.getByRole("img", { name: "QR code" }).querySelector("path")).toBeNull();
  });

  it("ignores a code that arrives after it has gone", async () => {
    const { unmount } = render(<QrCode text={LINK} label="QR code" />);
    unmount();

    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(document.querySelector("svg")).toBeNull();
  });
});
