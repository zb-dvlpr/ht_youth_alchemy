import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

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

const subscribeMountedSnapshot = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

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
  const resizeStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeMountedSnapshot,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  );

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

  useEffect(() => {
    if (!open || !isResizing) return;
    const onPointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState || event.pointerId !== resizeState.pointerId) return;
      const minWidth = 280;
      const minHeight = 160;
      const maxWidth = Math.max(minWidth, window.innerWidth - 32);
      const maxHeight = Math.max(minHeight, window.innerHeight - 32);
      const nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX);
      const nextHeight = resizeState.startHeight + (event.clientY - resizeState.startY);
      setSize({
        width: Math.max(minWidth, Math.min(maxWidth, nextWidth)),
        height: Math.max(minHeight, Math.min(maxHeight, nextHeight)),
      });
    };
    const stopResizing = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState || event.pointerId !== resizeState.pointerId) return;
      resizeStateRef.current = null;
      setIsResizing(false);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizing, open]);

  if (!open || !mounted || typeof document === "undefined") return null;
  const overlayClass =
    variant === "local" ? styles.confirmOverlay : styles.trainingOverlay;
  const cardStyle: CSSProperties = {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    ...(size ? { width: `${size.width}px`, height: `${size.height}px` } : {}),
  };

  return createPortal(
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
        className={`${styles.confirmCard}${isResizing ? ` ${styles.confirmCardResizing}` : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        style={cardStyle}
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
        <div
          className={styles.modalResizeHandle}
          aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            if (window.matchMedia("(max-width: 900px)").matches) return;
            const card = cardRef.current;
            if (!card) return;
            event.preventDefault();
            event.stopPropagation();
            resizeStateRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              startWidth: card.offsetWidth,
              startHeight: card.offsetHeight,
            };
            setIsResizing(true);
          }}
        />
      </div>
    </div>,
    document.body
  );
}
