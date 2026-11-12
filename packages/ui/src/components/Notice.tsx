import type { ReactNode } from "react";
import "./Notice.css";

export type NoticeTone = "info" | "warning" | "error";

export interface NoticeProps {
  readonly tone: NoticeTone;
  readonly children: ReactNode;
  readonly className?: string;
  /** The lead word in the page's language; the tone's English word when left out. */
  readonly leadWord?: string;
}

const leadWords: Record<NoticeTone, string> = {
  info: "Note:",
  warning: "Warning:",
  error: "Problem:",
};

/** Inline box that calls attention to a short message. The lead word means colour is never the only signal. */
export function Notice({ tone, children, className, leadWord = leadWords[tone] }: NoticeProps) {
  const classes = ["mb-notice", `mb-notice--${tone}`, className].filter(Boolean).join(" ");
  const content = (
    <>
      <strong>{leadWord}</strong> {children}
    </>
  );

  return tone === "error" ? (
    <div role="alert" className={classes}>
      {content}
    </div>
  ) : (
    <output className={classes}>{content}</output>
  );
}
