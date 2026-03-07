"use client";

import {
  type FocusEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  withCard?: boolean;
  followCursor?: boolean;
};

type Position = { top: number; left: number };
type CursorPoint = { x: number; y: number };

const VIEWPORT_PADDING = 8;

export default function Tooltip({
  content,
  children,
  offset = 10,
  disabled,
  preferred = "bottom",
  fullWidth = false,
  variant = "default",
  withCard = true,
  followCursor = false,
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<CursorPoint | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const updatePosition = useCallback((cursorPoint: CursorPoint | null = null) => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const anchorX =
      followCursor && cursorPoint ? cursorPoint.x : triggerRect.left + triggerRect.width / 2;
    const anchorTop = followCursor && cursorPoint ? cursorPoint.y : triggerRect.top;
    const anchorBottom = followCursor && cursorPoint ? cursorPoint.y : triggerRect.bottom;

    let left = anchorX - tooltipRect.width / 2;
    let top =
      preferred === "top"
        ? anchorTop - tooltipRect.height - offset
        : anchorBottom + offset;

    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
    if (left + tooltipRect.width > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - VIEWPORT_PADDING - tooltipRect.width;
    }

    if (top < VIEWPORT_PADDING) {
      top = anchorBottom + offset;
    }

    if (top + tooltipRect.height > window.innerHeight - VIEWPORT_PADDING) {
      top = anchorTop - tooltipRect.height - offset;
      if (top < VIEWPORT_PADDING) {
        top = Math.max(
          VIEWPORT_PADDING,
          window.innerHeight - VIEWPORT_PADDING - tooltipRect.height
        );
      }
    }

    setPosition({ top, left });
  }, [followCursor, offset, preferred]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition(cursorRef.current);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handle = () => updatePosition(cursorRef.current);
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const closeTooltip = () => setOpen(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        closeTooltip();
      }
    };
    window.addEventListener("blur", closeTooltip);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", closeTooltip);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleFocus = (event: FocusEvent<HTMLSpanElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.matches(":focus-visible")) {
      setOpen(true);
    }
  };

  const handleMouseEnter = (event: ReactMouseEvent<HTMLSpanElement>) => {
    if (followCursor) {
      cursorRef.current = { x: event.clientX, y: event.clientY };
    }
    setOpen(true);
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLSpanElement>) => {
    if (!followCursor || !open) return;
    const point = { x: event.clientX, y: event.clientY };
    cursorRef.current = point;
    updatePosition(point);
  };

  const handleMouseLeave = () => {
    setOpen(false);
    cursorRef.current = null;
  };

  if (!content || disabled) {
    return (
      <span className={fullWidth ? styles.triggerFull : styles.trigger}>
        {children}
      </span>
    );
  }

  const resolvedContent = withCard ? (
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
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
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
