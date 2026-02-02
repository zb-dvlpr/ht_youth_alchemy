"use client";

import { useEffect, useRef, useState } from "react";
import Tooltip from "./Tooltip";
import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";

type HelpToggleButtonProps = {
  messages: Messages;
};

export default function HelpToggleButton({ messages }: HelpToggleButtonProps) {
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
      <Tooltip content={messages.helpOpenTooltip}>
        <button
          type="button"
          className={styles.helpButton}
          aria-label={messages.helpOpenTooltip}
          onClick={() => setOpen((prev) => !prev)}
          ref={buttonRef}
        >
          {messages.helpIcon}
        </button>
      </Tooltip>
      {open ? (
        <div className={styles.feedbackMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={() => {
              if (typeof window === "undefined") return;
              window.dispatchEvent(new CustomEvent("ya:help-open"));
              setOpen(false);
            }}
          >
            {messages.helpMenuOpen}
          </button>
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={() => {
              if (typeof window === "undefined") return;
              window.dispatchEvent(new CustomEvent("ya:changelog-open"));
              setOpen(false);
            }}
          >
            {messages.helpMenuChangelog}
          </button>
        </div>
      ) : null}
    </div>
  );
}
