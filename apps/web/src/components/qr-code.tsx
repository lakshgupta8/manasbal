"use client";

import { useEffect, useState } from "react";

// The white border around the code, in modules: readers need it to find the code.
export const QUIET_ZONE = 4;

// One square per dark module, as an SVG path.
export function modulesPath(size: number, dark: (x: number, y: number) => boolean): string {
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dark(x, y)) path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return path;
}

interface Drawn {
  readonly path: string;
  readonly size: number;
}

export interface QrCodeProps {
  // What the code holds: the authenticator app's otpauth:// link.
  readonly text: string;
  // Its accessible name. The same secret is always written next to it as text.
  readonly label: string;
}

// A QR code made in the browser, so the secret it holds is never sent anywhere to be drawn. The
// encoder (lean-qr's small build, MIT licence) loads only when the code is shown. Dark modules on
// a white tile, with a quiet zone, in light and dark themes alike, so any reader can scan it.
export function QrCode({ text, label }: QrCodeProps) {
  const [drawn, setDrawn] = useState<Drawn | null>(null);

  useEffect(() => {
    let current = true;
    import("lean-qr/nano").then(
      ({ generate, correction }) => {
        if (!current) return;
        const code = generate(text, { minCorrectionLevel: correction.M });
        setDrawn({ path: modulesPath(code.size, code.get), size: code.size + QUIET_ZONE * 2 });
      },
      // Without the encoder there is no picture; the key written beside it still works.
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [text]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${drawn?.size ?? 1} ${drawn?.size ?? 1}`}
      shapeRendering="crispEdges"
      className="bg-base-white rounded-lg size-48 text-grey-900"
    >
      {drawn !== null && <path d={drawn.path} fill="currentColor" />}
    </svg>
  );
}
