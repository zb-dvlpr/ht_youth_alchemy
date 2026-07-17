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

type ViewportRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ModalProps = {
  open: boolean;
  title?: string;
  body?: ReactNode;
  actions?: ReactNode;
  variant?: ModalVariant;
  className?: string;
  autoPosition?: boolean;
  movable?: boolean;
  closeOnBackdrop?: boolean;
  onClose?: () => void;
};

const subscribeMountedSnapshot = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;
const MODAL_EDGE_GAP = 16;
const MODAL_MIN_WIDTH = 280;
const MODAL_MIN_HEIGHT = 160;

const readViewportRect = (): ViewportRect => {
  if (typeof window === "undefined") {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const visualViewport = window.visualViewport;
  if (visualViewport) {
    return {
      left: visualViewport.offsetLeft,
      top: visualViewport.offsetTop,
      width: visualViewport.width,
      height: visualViewport.height,
    };
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const clampModalSize = (
  width: number,
  height: number,
  viewport: ViewportRect
) => {
  const maxWidth = Math.max(MODAL_MIN_WIDTH, viewport.width - MODAL_EDGE_GAP * 2);
  const maxHeight = Math.max(
    MODAL_MIN_HEIGHT,
    viewport.height - MODAL_EDGE_GAP * 2
  );
  return {
    width: Math.max(MODAL_MIN_WIDTH, Math.min(maxWidth, width)),
    height: Math.max(MODAL_MIN_HEIGHT, Math.min(maxHeight, height)),
  };
};

const clampModalPosition = (
  left: number,
  top: number,
  width: number,
  height: number,
  viewport: ViewportRect
) => {
  const minLeft = viewport.left + MODAL_EDGE_GAP;
  const minTop = viewport.top + MODAL_EDGE_GAP;
  const maxLeft = Math.max(
    minLeft,
    viewport.left + viewport.width - width - MODAL_EDGE_GAP
  );
  const maxTop = Math.max(
    minTop,
    viewport.top + viewport.height - height - MODAL_EDGE_GAP
  );
  return {
    left: Math.max(minLeft, Math.min(maxLeft, left)),
    top: Math.max(minTop, Math.min(maxTop, top)),
  };
};

const centerModalPosition = (
  width: number,
  height: number,
  viewport: ViewportRect
) =>
  clampModalPosition(
    viewport.left + (viewport.width - width) / 2,
    viewport.top + (viewport.height - height) / 2,
    width,
    height,
    viewport
  );

const positionsEqual = (
  left: { left: number; top: number } | null,
  right: { left: number; top: number } | null
) => left?.left === right?.left && left?.top === right?.top;

const sizesEqual = (
  left: { width: number; height: number } | null,
  right: { width: number; height: number } | null
) => left?.width === right?.width && left?.height === right?.height;

export default function Modal({
  open,
  title,
  body,
  actions,
  variant = "global",
  className,
  autoPosition = true,
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
  const wasOpenRef = useRef(false);
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
    if (!open) {
      wasOpenRef.current = false;
      dragStateRef.current = null;
      resizeStateRef.current = null;
      const frameId = window.requestAnimationFrame(() => {
        setIsDragging(false);
        setIsResizing(false);
      });
      return () => window.cancelAnimationFrame(frameId);
    }
    if (!mounted || !desktopViewportActive || !autoPosition) return;
    const isFreshOpen = !wasOpenRef.current;
    wasOpenRef.current = true;
    const frameId = window.requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card) return;
      const viewport = readViewportRect();
      const measuredWidth = size?.width ?? card.offsetWidth;
      const measuredHeight = size?.height ?? card.offsetHeight;
      const measuredBounds = clampModalSize(measuredWidth, measuredHeight, viewport);
      const nextSize = size
        ? clampModalSize(size.width, size.height, viewport)
        : null;
      const width = nextSize?.width ?? measuredBounds.width;
      const height = nextSize?.height ?? measuredBounds.height;
      if (nextSize && !sizesEqual(size, nextSize)) {
        setSize(nextSize);
      }
      const nextPosition = isFreshOpen
        ? centerModalPosition(width, height, viewport)
        : null;
      if (nextPosition) {
        setPosition((current) =>
          positionsEqual(current, nextPosition) ? current : nextPosition
        );
        return;
      }
      setPosition((current) => {
        const clamped = current
          ? clampModalPosition(current.left, current.top, width, height, viewport)
          : centerModalPosition(width, height, viewport);
        return positionsEqual(current, clamped) ? current : clamped;
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [autoPosition, desktopViewportActive, mounted, open, size]);

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
        clampModalPosition(
          rawLeft,
          rawTop,
          card.offsetWidth,
          card.offsetHeight,
          readViewportRect()
        )
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
      const viewport = readViewportRect();
      const maxWidth = Math.max(
        MODAL_MIN_WIDTH,
        viewport.left + viewport.width - resizeState.startLeft - MODAL_EDGE_GAP
      );
      const maxHeight = Math.max(
        MODAL_MIN_HEIGHT,
        viewport.top + viewport.height - resizeState.startTop - MODAL_EDGE_GAP
      );
      const nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX);
      const nextHeight = resizeState.startHeight + (event.clientY - resizeState.startY);
      const width = Math.max(MODAL_MIN_WIDTH, Math.min(maxWidth, nextWidth));
      const height = Math.max(MODAL_MIN_HEIGHT, Math.min(maxHeight, nextHeight));
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
    if (!open || !desktopViewportActive || !autoPosition) return;
    let frameId: number | null = null;
    const reclamp = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const card = cardRef.current;
        if (!card) return;
        const viewport = readViewportRect();
        const measuredWidth = size?.width ?? card.offsetWidth;
        const measuredHeight = size?.height ?? card.offsetHeight;
        const measuredBounds = clampModalSize(
          measuredWidth,
          measuredHeight,
          viewport
        );
        const nextSize = size
          ? clampModalSize(size.width, size.height, viewport)
          : null;
        const width = nextSize?.width ?? measuredBounds.width;
        const height = nextSize?.height ?? measuredBounds.height;
        if (nextSize && !sizesEqual(size, nextSize)) {
          setSize(nextSize);
        }
        setPosition((current) => {
          const clamped = current
            ? clampModalPosition(current.left, current.top, width, height, viewport)
            : centerModalPosition(width, height, viewport);
          return positionsEqual(current, clamped) ? current : clamped;
        });
      });
    };
    window.addEventListener("resize", reclamp);
    window.addEventListener("orientationchange", reclamp);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", reclamp);
    visualViewport?.addEventListener("scroll", reclamp);
    const card = cardRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && card
        ? new ResizeObserver(reclamp)
        : null;
    if (card && resizeObserver) {
      resizeObserver.observe(card);
    }
    reclamp();
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", reclamp);
      window.removeEventListener("orientationchange", reclamp);
      visualViewport?.removeEventListener("resize", reclamp);
      visualViewport?.removeEventListener("scroll", reclamp);
      resizeObserver?.disconnect();
    };
  }, [autoPosition, desktopViewportActive, open, size]);

  if (!open || !mounted || typeof document === "undefined") return null;
  const overlayClass =
    variant === "local" ? styles.confirmOverlay : styles.trainingOverlay;
  const cardStyle: CSSProperties = {
    ...(autoPosition && desktopViewportActive && position
      ? {
          position: "fixed",
          left: `${position.left}px`,
          top: `${position.top}px`,
          margin: 0,
        }
      : {}),
    ...(desktopViewportActive && size
      ? { width: `${size.width}px`, height: `${size.height}px` }
      : {}),
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
