"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Messages } from "@/lib/i18n";
import { buildYouTubeEmbedUrl } from "@/lib/youtube";
import YouTubeIcon from "./YouTubeIcon";
import styles from "./youtube.module.css";

export type YouTubePlayerPosition = {
  x: number;
  y: number;
};

export type YouTubePlayerDimensions = {
  width: number;
  videoHeight: number;
};

type ActiveVideo = {
  videoId: string;
  originalUrl: string;
  title?: string;
};

type YouTubeVideoPlayerProps = {
  messages: Messages;
  activeVideo: ActiveVideo | null;
  minimized: boolean;
  position: YouTubePlayerPosition;
  dimensions: YouTubePlayerDimensions;
  onClose: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onPositionChange: (position: YouTubePlayerPosition) => void;
  onDimensionsChange: (dimensions: YouTubePlayerDimensions) => void;
};

const HEADER_HEIGHT = 44;
const SAFE_MARGIN = 12;
const DESKTOP_BREAKPOINT = 901;
const MIN_WIDTH_DESKTOP = 356;
const MIN_VIDEO_HEIGHT_DESKTOP = 200;
const MIN_WIDTH_MOBILE = 300;
const MIN_VIDEO_HEIGHT_MOBILE = 190;
const DEFAULT_WIDTH_DESKTOP = 520;
const DEFAULT_WIDTH_MOBILE = 360;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth < DESKTOP_BREAKPOINT;

const viewportBounds = () => {
  const width = typeof window === "undefined" ? 1024 : window.innerWidth;
  const height = typeof window === "undefined" ? 768 : window.innerHeight;
  return { width, height };
};

const clampDimensions = (
  dimensions: YouTubePlayerDimensions,
  minimized: boolean
): YouTubePlayerDimensions => {
  const { width: viewportWidth, height: viewportHeight } = viewportBounds();
  const mobile = viewportWidth < DESKTOP_BREAKPOINT;
  const maxWidth = Math.max(260, viewportWidth - SAFE_MARGIN * 2);
  const maxVideoHeight = Math.max(
    mobile ? MIN_VIDEO_HEIGHT_MOBILE : MIN_VIDEO_HEIGHT_DESKTOP,
    viewportHeight - HEADER_HEIGHT - SAFE_MARGIN * 2
  );
  const minWidth = Math.min(
    mobile ? MIN_WIDTH_MOBILE : MIN_WIDTH_DESKTOP,
    maxWidth
  );
  const width = clamp(dimensions.width, minWidth, maxWidth);
  const idealVideoHeight = Math.round(width * 9 / 16);
  const minVideoHeight = Math.min(
    mobile ? MIN_VIDEO_HEIGHT_MOBILE : MIN_VIDEO_HEIGHT_DESKTOP,
    maxVideoHeight
  );
  const videoHeight = minimized
    ? 0
    : clamp(dimensions.videoHeight || idealVideoHeight, minVideoHeight, maxVideoHeight);

  return { width, videoHeight };
};

const clampPosition = (
  position: YouTubePlayerPosition,
  dimensions: YouTubePlayerDimensions,
  minimized: boolean
): YouTubePlayerPosition => {
  const { width: viewportWidth, height: viewportHeight } = viewportBounds();
  const height = minimized ? HEADER_HEIGHT : HEADER_HEIGHT + dimensions.videoHeight;
  const maxX = Math.max(SAFE_MARGIN, viewportWidth - dimensions.width - SAFE_MARGIN);
  const maxY = Math.max(SAFE_MARGIN, viewportHeight - height - SAFE_MARGIN);
  return {
    x: clamp(position.x, SAFE_MARGIN, maxX),
    y: clamp(position.y, SAFE_MARGIN, maxY),
  };
};

const defaultPlacement = (
  dimensions: YouTubePlayerDimensions,
  minimized: boolean
): YouTubePlayerPosition => {
  const { width: viewportWidth, height: viewportHeight } = viewportBounds();
  const height = minimized ? HEADER_HEIGHT : HEADER_HEIGHT + dimensions.videoHeight;
  return clampPosition(
    {
      x: viewportWidth - dimensions.width - 24,
      y: viewportHeight - height - 24,
    },
    dimensions,
    minimized
  );
};

const pointerDistance = (first: Pointer, second: Pointer) =>
  Math.hypot(first.x - second.x, first.y - second.y);

type Pointer = {
  x: number;
  y: number;
};

export default function YouTubeVideoPlayer({
  messages,
  activeVideo,
  minimized,
  position,
  dimensions,
  onClose,
  onMinimize,
  onRestore,
  onPositionChange,
  onDimensionsChange,
}: YouTubeVideoPlayerProps) {
  const [adjustMode, setAdjustMode] = useState(false);
  const hasPlacedRef = useRef(false);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startPosition: YouTubePlayerPosition;
  } | null>(null);
  const resizeStateRef = useRef<{
    startX: number;
    startY: number;
    startDimensions: YouTubePlayerDimensions;
  } | null>(null);
  const activePointersRef = useRef<Map<number, Pointer>>(new Map());
  const adjustStateRef = useRef<{
    startDistance: number;
    startDimensions: YouTubePlayerDimensions;
    startPosition: YouTubePlayerPosition;
    startCenter: Pointer;
  } | null>(null);

  const clampedDimensions = useMemo(
    () => clampDimensions(dimensions, minimized),
    [dimensions, minimized]
  );
  const clampedPosition = useMemo(
    () => clampPosition(position, clampedDimensions, minimized),
    [clampedDimensions, minimized, position]
  );
  const embedUrl = activeVideo ? buildYouTubeEmbedUrl(activeVideo.videoId) : "";
  const title = activeVideo?.title ?? messages.youtubePlayerTitle;
  const mobile = isMobileViewport();

  useEffect(() => {
    if (!activeVideo || hasPlacedRef.current) return;
    const initialWidth = isMobileViewport()
      ? Math.min(DEFAULT_WIDTH_MOBILE, window.innerWidth - SAFE_MARGIN * 2)
      : DEFAULT_WIDTH_DESKTOP;
    const initialDimensions = clampDimensions(
      {
        width: initialWidth,
        videoHeight: Math.round(initialWidth * 9 / 16),
      },
      false
    );
    onDimensionsChange(initialDimensions);
    onPositionChange(defaultPlacement(initialDimensions, false));
    hasPlacedRef.current = true;
  }, [activeVideo, onDimensionsChange, onPositionChange]);

  useEffect(() => {
    if (!activeVideo) {
      activePointersRef.current.clear();
      adjustStateRef.current = null;
      return;
    }
    const handleResize = () => {
      const nextDimensions = clampDimensions(dimensions, minimized);
      onDimensionsChange(nextDimensions);
      onPositionChange(clampPosition(position, nextDimensions, minimized));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAdjustMode(false);
        onClose();
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeVideo,
    dimensions,
    minimized,
    onClose,
    onDimensionsChange,
    onPositionChange,
    position,
  ]);

  const updatePanelPosition = useCallback(
    (nextPosition: YouTubePlayerPosition) => {
      onPositionChange(clampPosition(nextPosition, clampedDimensions, minimized));
    },
    [clampedDimensions, minimized, onPositionChange]
  );

  const updatePanelDimensions = useCallback(
    (nextDimensions: YouTubePlayerDimensions) => {
      const clamped = clampDimensions(nextDimensions, minimized);
      onDimensionsChange(clamped);
      onPositionChange(clampPosition(clampedPosition, clamped, minimized));
    },
    [clampedPosition, minimized, onDimensionsChange, onPositionChange]
  );

  const handleDragPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startPosition: clampedPosition,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = dragStateRef.current;
    if (!state) return;
    updatePanelPosition({
      x: state.startPosition.x + event.clientX - state.startX,
      y: state.startPosition.y + event.clientY - state.startY,
    });
  };

  const handleDragPointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startDimensions: clampedDimensions,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = resizeStateRef.current;
    if (!state) return;
    const nextWidth = state.startDimensions.width + event.clientX - state.startX;
    const nextVideoHeight = Math.round(nextWidth * 9 / 16);
    updatePanelDimensions({
      width: nextWidth,
      videoHeight: nextVideoHeight,
    });
  };

  const handleResizePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    resizeStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const updateAdjustState = (pointers: Pointer[]) => {
    if (pointers.length === 1) {
      adjustStateRef.current = {
        startDistance: 0,
        startDimensions: clampedDimensions,
        startPosition: clampedPosition,
        startCenter: pointers[0],
      };
      return;
    }
    if (pointers.length >= 2) {
      adjustStateRef.current = {
        startDistance: pointerDistance(pointers[0], pointers[1]),
        startDimensions: clampedDimensions,
        startPosition: clampedPosition,
        startCenter: {
          x: (pointers[0].x + pointers[1].x) / 2,
          y: (pointers[0].y + pointers[1].y) / 2,
        },
      };
    }
  };

  const handleAdjustPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    updateAdjustState([...activePointersRef.current.values()]);
  };

  const handleAdjustPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const pointers = [...activePointersRef.current.values()];
    const state = adjustStateRef.current;
    if (!state || pointers.length === 0) return;

    if (pointers.length === 1) {
      updatePanelPosition({
        x: state.startPosition.x + pointers[0].x - state.startCenter.x,
        y: state.startPosition.y + pointers[0].y - state.startCenter.y,
      });
      return;
    }

    const distance = pointerDistance(pointers[0], pointers[1]);
    const scale = state.startDistance > 0 ? distance / state.startDistance : 1;
    const nextWidth = state.startDimensions.width * scale;
    updatePanelDimensions({
      width: nextWidth,
      videoHeight: Math.round(nextWidth * 9 / 16),
    });
  };

  const handleAdjustPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updateAdjustState([...activePointersRef.current.values()]);
  };

  if (!activeVideo || typeof document === "undefined") return null;

  const player = (
    <div className={styles.playerPortalLayer}>
      <section
        className={styles.playerPanel}
        style={{
          width: `${clampedDimensions.width}px`,
          transform: `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`,
        }}
        role="region"
        aria-label={messages.youtubePlayerTitle}
      >
        <header className={styles.playerHeader}>
          <div
            className={styles.playerDragHandle}
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={handleDragPointerEnd}
            onPointerCancel={handleDragPointerEnd}
          >
            <YouTubeIcon className={styles.playerHeaderIcon} />
            <span className={styles.playerTitle}>{title}</span>
          </div>
          <div
            className={styles.playerControls}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {mobile && !minimized ? (
              <button
                type="button"
                className={styles.playerControlButton}
                onClick={(event) => {
                  event.stopPropagation();
                  setAdjustMode((current) => !current);
                }}
              >
                {adjustMode
                  ? messages.youtubePlayerDoneAdjusting
                  : messages.youtubePlayerAdjust}
              </button>
            ) : null}
            {minimized ? (
              <button
                type="button"
                className={styles.playerControlButton}
                onClick={(event) => {
                  event.stopPropagation();
                  onRestore();
                }}
                aria-label={messages.youtubePlayerRestore}
              >
                ↗
              </button>
            ) : (
              <button
                type="button"
                className={styles.playerControlButton}
                onClick={(event) => {
                  event.stopPropagation();
                  onMinimize();
                }}
                aria-label={messages.youtubePlayerMinimize}
              >
                _
              </button>
            )}
            <a
              className={styles.playerControlButton}
              href={activeVideo.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              aria-label={messages.youtubePlayerOpenExternal}
            >
              ↗
            </a>
            <button
              type="button"
              className={styles.playerControlButton}
              onClick={(event) => {
                event.stopPropagation();
                setAdjustMode(false);
                onClose();
              }}
              aria-label={messages.youtubePlayerClose}
            >
              ×
            </button>
          </div>
        </header>
        <div
          className={`${styles.playerViewport} ${
            minimized ? styles.playerViewportMinimized : ""
          }`}
          style={{ height: `${clampedDimensions.videoHeight}px` }}
        >
          <iframe
            key={activeVideo.videoId}
            className={styles.playerIframe}
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          {adjustMode && !minimized ? (
            <div
              className={styles.adjustOverlay}
              onPointerDown={handleAdjustPointerDown}
              onPointerMove={handleAdjustPointerMove}
              onPointerUp={handleAdjustPointerEnd}
              onPointerCancel={handleAdjustPointerEnd}
            >
              <span className={styles.adjustHint}>
                {messages.youtubePlayerAdjustHint}
              </span>
            </div>
          ) : null}
          {!mobile && !minimized ? (
            <button
              type="button"
              className={styles.resizeHandle}
              aria-label={messages.youtubePlayerResize}
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerEnd}
              onPointerCancel={handleResizePointerEnd}
            />
          ) : null}
        </div>
      </section>
    </div>
  );

  return createPortal(player, document.body);
}
