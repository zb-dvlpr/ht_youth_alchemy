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
  const DESKTOP_MODAL_MEDIA_QUERY = "(min-width: 901px)";
  const backdropPressStartedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const resizeStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const [desktopViewportActive, setDesktopViewportActive] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeMountedSnapshot,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  );

  const clampPosition = (
    left: number,
    top: number,
    width: number,
    height: number
  ) => {
    const minLeft = 16;
    const minTop = 16;
    const maxLeft = Math.max(minLeft, window.innerWidth - width - 16);
    const maxTop = Math.max(minTop, window.innerHeight - height - 16);
    return {
      left: Math.max(minLeft, Math.min(maxLeft, left)),
      top: Math.max(minTop, Math.min(maxTop, top)),
    };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(DESKTOP_MODAL_MEDIA_QUERY);
    const sync = () => {
      setDesktopViewportActive(mediaQuery.matches);
    };
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, [DESKTOP_MODAL_MEDIA_QUERY]);

  useEffect(() => {
    if (!open || !mounted || !desktopViewportActive) return;
    const frameId = window.requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card) return;
      const width = size?.width ?? card.offsetWidth;
      const height = size?.height ?? card.offsetHeight;
      setPosition((current) =>
        current ?? clampPosition((window.innerWidth - width) / 2, (window.innerHeight - height) / 2, width, height)
      );
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [desktopViewportActive, mounted, open, size]);

  useEffect(() => {
    if (!open || !isDragging) return;
    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const rawLeft = dragState.originLeft + (event.clientX - dragState.startX);
      const rawTop = dragState.originTop + (event.clientY - dragState.startY);
      const card = cardRef.current;
      if (!card) {
        setPosition((current) =>
          current
            ? {
                left: rawLeft,
                top: rawTop,
              }
            : current
        );
        return;
      }
      setPosition(
        clampPosition(rawLeft, rawTop, card.offsetWidth, card.offsetHeight)
      );
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
      const maxWidth = Math.max(
        minWidth,
        window.innerWidth - resizeState.startLeft - 16
      );
      const maxHeight = Math.max(
        minHeight,
        window.innerHeight - resizeState.startTop - 16
      );
      const nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX);
      const nextHeight = resizeState.startHeight + (event.clientY - resizeState.startY);
      const width = Math.max(minWidth, Math.min(maxWidth, nextWidth));
      const height = Math.max(minHeight, Math.min(maxHeight, nextHeight));
      setSize({ width, height });
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

  useEffect(() => {
    if (!open || !desktopViewportActive) return;
    const onResize = () => {
      const card = cardRef.current;
      if (!card) return;
      const width = size?.width ?? card.offsetWidth;
      const height = size?.height ?? card.offsetHeight;
      const maxWidth = Math.max(280, window.innerWidth - 32);
      const maxHeight = Math.max(160, window.innerHeight - 32);
      if (size && (size.width > maxWidth || size.height > maxHeight)) {
        setSize({
          width: Math.min(size.width, maxWidth),
          height: Math.min(size.height, maxHeight),
        });
      }
      setPosition((current) =>
        current ? clampPosition(current.left, current.top, width, height) : current
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [desktopViewportActive, open, size]);

  if (!open || !mounted || typeof document === "undefined") return null;
  const overlayClass =
    variant === "local" ? styles.confirmOverlay : styles.trainingOverlay;
  const cardStyle: CSSProperties = {
    ...(desktopViewportActive && position
      ? {
          position: "fixed",
          left: `${position.left}px`,
          top: `${position.top}px`,
          margin: 0,
        }
      : {}),
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
              if (!desktopViewportActive) return;
              if (event.button !== 0) return;
              event.preventDefault();
              const card = cardRef.current;
              if (!card) return;
              const rect = card.getBoundingClientRect();
              dragStateRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originLeft: position?.left ?? rect.left,
                originTop: position?.top ?? rect.top,
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
              startLeft: card.getBoundingClientRect().left,
              startTop: card.getBoundingClientRect().top,
            };
            setIsResizing(true);
          }}
        />
      </div>
    </div>,
    document.body
  );
}
