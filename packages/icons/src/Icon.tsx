import { useId, type ReactNode, type SVGProps } from "react";

/** The sizes the icons are drawn to work at, in px. */
export type IconSize = 16 | 20 | 24;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  /** Width and height in px. Defaults to 24. */
  readonly size?: IconSize;
  /** Accessible name. Without one the icon is decorative and hidden from assistive tech. */
  readonly title?: string;
}

/**
 * The frame every icon shares: the 24 × 24 grid and the line settings from the drawing rules
 * (README.md). Each generated icon passes only its shapes.
 */
export function Icon({
  size = 24,
  title,
  children,
  ...props
}: IconProps & { readonly children: ReactNode }) {
  const titleId = useId();
  const a11y = title ? { role: "img", "aria-labelledby": titleId } : { "aria-hidden": true };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
      {...props}
    >
      {title && <title id={titleId}>{title}</title>}
      {children}
    </svg>
  );
}
