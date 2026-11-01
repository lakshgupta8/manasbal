import type { ReactNode } from "react";
import "./Notice.css";

export type NoticeTone = "info" | "warning" | "error";

export interface NoticeProps {
  readonly tone: NoticeTone;
  readonly children: ReactNode;
  readonly className?: string;
}

const leadWords: Record<NoticeTone, string> = {
  info: "Note:",
  warning: "Warning:",
  error: "Problem:",
};

/** Inline box that calls attention to a short message. The lead word means colour is never the only signal. */
export function Notice({ tone, children, className }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={["mb-notice", `mb-notice--${tone}`, className].filter(Boolean).join(" ")}
    >
      <strong>{leadWords[tone]}</strong> {children}
    </div>
  );
}
