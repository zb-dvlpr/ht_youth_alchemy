"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";

type FeedbackButtonProps = {
  messages: Messages;
};

const BUG_URL =
  "https://github.com/zb-dvlpr/ht_youth_alchemy/issues/new?template=bug_report.md";
const FEATURE_URL =
  "https://github.com/zb-dvlpr/ht_youth_alchemy/issues/new?template=feature_request.md";

export default function FeedbackButton({ messages }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target ?? null)) return;
      if (menuRef.current?.contains(target ?? null)) return;
      setOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <div className={styles.feedbackWrap}>
      <Tooltip content={messages.feedbackTooltip}>
        <button
          type="button"
          className={styles.feedbackButton}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={messages.feedbackTooltip}
          ref={buttonRef}
        >
          💬
        </button>
      </Tooltip>
      {open ? (
        <div className={styles.feedbackMenu} ref={menuRef}>
          <a
            className={styles.feedbackLink}
            href={BUG_URL}
            target="_blank"
            rel="noreferrer"
          >
            {messages.feedbackBug}
          </a>
          <a
            className={styles.feedbackLink}
            href={FEATURE_URL}
            target="_blank"
            rel="noreferrer"
          >
            {messages.feedbackFeature}
          </a>
        </div>
      ) : null}
    </div>
  );
}
