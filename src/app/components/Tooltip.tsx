"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./tooltip.module.css";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  offset?: number;
  disabled?: boolean;
  preferred?: "bottom" | "top";
  fullWidth?: boolean;
  variant?: "default" | "stacked";
};

type Position = { top: number; left: number };

const VIEWPORT_PADDING = 8;

export default function Tooltip({
  content,
  children,
  offset = 10,
  disabled,
  preferred = "bottom",
  fullWidth = false,
  variant = "default",
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    let top =
      preferred === "top"
        ? triggerRect.top - tooltipRect.height - offset
        : triggerRect.bottom + offset;

    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
    if (left + tooltipRect.width > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - VIEWPORT_PADDING - tooltipRect.width;
    }

    if (top < VIEWPORT_PADDING) {
      top = triggerRect.bottom + offset;
    }

    if (top + tooltipRect.height > window.innerHeight - VIEWPORT_PADDING) {
      top = triggerRect.top - tooltipRect.height - offset;
      if (top < VIEWPORT_PADDING) {
        top = Math.max(
          VIEWPORT_PADDING,
          window.innerHeight - VIEWPORT_PADDING - tooltipRect.height
        );
      }
    }

    setPosition({ top, left });
  }, [offset, preferred]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handle = () => updatePosition();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open, updatePosition]);

  if (!content || disabled) {
    return (
      <span className={fullWidth ? styles.triggerFull : styles.trigger}>
        {children}
      </span>
    );
  }

  const resolvedContent =
    typeof content === "string" || typeof content === "number" ? (
      <div
        className={`${styles.tooltipCard} ${
          variant === "stacked" ? styles.tooltipCardStacked : ""
        }`}
      >
        {content}
      </div>
    ) : (
      content
    );

  return (
    <span
      className={fullWidth ? styles.triggerFull : styles.trigger}
      ref={triggerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open
        ? createPortal(
            <div
              className={styles.tooltip}
              ref={tooltipRef}
              style={
                position
                  ? { top: position.top, left: position.left }
                  : undefined
              }
              role="tooltip"
            >
              {resolvedContent}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
