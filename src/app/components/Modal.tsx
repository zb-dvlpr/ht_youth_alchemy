import { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "../page.module.css";

type ModalVariant = "local" | "global";

type ModalProps = {
  open: boolean;
  title?: string;
  body?: ReactNode;
  actions?: ReactNode;
  variant?: ModalVariant;
  className?: string;
  movable?: boolean;
  closeOnBackdrop?: boolean;
  onClose?: () => void;
};

export default function Modal({
  open,
  title,
  body,
  actions,
  variant = "global",
  className,
  movable = true,
  closeOnBackdrop = false,
  onClose,
}: ModalProps) {
  const backdropPressStartedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!open || !isDragging) return;
    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const rawX = dragState.originX + (event.clientX - dragState.startX);
      const rawY = dragState.originY + (event.clientY - dragState.startY);
      const card = cardRef.current;
      if (!card) {
        setOffset({ x: rawX, y: rawY });
        return;
      }
      const maxX = Math.max(0, (window.innerWidth - card.offsetWidth) / 2);
      const maxY = Math.max(0, (window.innerHeight - card.offsetHeight) / 2);
      setOffset({
        x: Math.max(-maxX, Math.min(maxX, rawX)),
        y: Math.max(-maxY, Math.min(maxY, rawY)),
      });
    };
    const stopDragging = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      dragStateRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [isDragging, open]);

  if (!open) return null;
  const overlayClass =
    variant === "local" ? styles.confirmOverlay : styles.trainingOverlay;

  return (
    <div
      className={overlayClass}
      onMouseDown={(event) => {
        backdropPressStartedRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        const startedOnBackdrop = backdropPressStartedRef.current;
        backdropPressStartedRef.current = false;
        if (!closeOnBackdrop) return;
        if (event.target !== event.currentTarget) return;
        if (!startedOnBackdrop) return;
        onClose?.();
      }}
    >
      <div
        ref={cardRef}
        className={`${styles.confirmCard}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        {title ? (
          <div
            className={`${styles.confirmTitle}${movable ? ` ${styles.confirmTitleMovable}` : ""}${isDragging ? ` ${styles.confirmTitleDragging}` : ""}`}
            onPointerDown={(event) => {
              if (!movable) return;
              if (event.button !== 0) return;
              event.preventDefault();
              dragStateRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originX: offset.x,
                originY: offset.y,
              };
              setIsDragging(true);
            }}
          >
            {title}
          </div>
        ) : null}
        {body ? <div className={styles.confirmBody}>{body}</div> : null}
        {actions ? (
          <div className={styles.confirmActions}>{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
