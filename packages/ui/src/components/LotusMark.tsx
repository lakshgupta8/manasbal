import { useId, type SVGProps } from "react";

export interface LotusMarkProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Width and height in px. */
  readonly size?: number;
  /** Accessible name. Without one the mark is decorative and hidden from assistive tech. */
  readonly title?: string;
}

/** The Manasbal brand mark: a lotus on the lake, drawn in-house. */
export function LotusMark({ size = 32, title, ...props }: LotusMarkProps) {
  const titleId = useId();
  const a11y = title ? { role: "img", "aria-labelledby": titleId } : { "aria-hidden": true };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="4 10 92 92"
      width={size}
      height={size}
      focusable="false"
      {...a11y}
      {...props}
    >
      {title && <title id={titleId}>{title}</title>}
      <path d="M50 68C34 70 18 64 10 54C26 52 40 56 50 68Z" fill="#F4A3BE" />
      <path d="M50 68C66 70 82 64 90 54C74 52 60 56 50 68Z" fill="#F4A3BE" />
      <path d="M50 66C36 62 24 50 22 36C34 38 46 48 50 66Z" fill="#EE7AA0" />
      <path d="M50 66C64 62 76 50 78 36C66 38 54 48 50 66Z" fill="#EE7AA0" />
      <path d="M50 16C62 32 62 52 50 66C38 52 38 32 50 16Z" fill="#D9406F" />
      <path
        d="M18 82Q34 75 50 82T82 82"
        fill="none"
        stroke="#167E86"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M30 94Q40 89 50 94T70 94"
        fill="none"
        stroke="#167E86"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
