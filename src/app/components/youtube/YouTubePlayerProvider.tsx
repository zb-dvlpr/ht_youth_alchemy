"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Messages } from "@/lib/i18n";
import { resolveYouTubeTarget } from "@/lib/youtube";
import YouTubeVideoPlayer, {
  type YouTubePlayerDimensions,
  type YouTubePlayerPosition,
} from "./YouTubeVideoPlayer";

type ActiveVideo = {
  videoId: string;
  originalUrl: string;
  title?: string;
};

type OpenYouTubeVideoOptions = {
  url: string;
  title?: string;
  triggerElement?: HTMLElement | null;
};

type YouTubePlayerContextValue = {
  activeVideo: ActiveVideo | null;
  minimized: boolean;
  openVideo: (options: OpenYouTubeVideoOptions) => void;
  closeVideo: () => void;
  minimizeVideo: () => void;
  restoreVideo: () => void;
  updatePosition: (position: YouTubePlayerPosition) => void;
  updateDimensions: (dimensions: YouTubePlayerDimensions) => void;
};

const YouTubePlayerContext = createContext<YouTubePlayerContextValue | null>(null);

type YouTubePlayerProviderProps = {
  messages: Messages;
  children: ReactNode;
};

const DEFAULT_POSITION: YouTubePlayerPosition = { x: 0, y: 0 };
const DEFAULT_DIMENSIONS: YouTubePlayerDimensions = {
  width: 520,
  videoHeight: 292,
};

export function YouTubePlayerProvider({
  messages,
  children,
}: YouTubePlayerProviderProps) {
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] =
    useState<YouTubePlayerPosition>(DEFAULT_POSITION);
  const [dimensions, setDimensions] =
    useState<YouTubePlayerDimensions>(DEFAULT_DIMENSIONS);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    if (activeVideo) {
      root.dataset.youtubePlayerOpen = "true";
    } else {
      delete root.dataset.youtubePlayerOpen;
    }

    return () => {
      delete root.dataset.youtubePlayerOpen;
    };
  }, [activeVideo]);

  const closeVideo = useCallback(() => {
    setActiveVideo(null);
    setMinimized(false);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    window.setTimeout(() => trigger?.focus(), 0);
  }, []);

  const openVideo = useCallback(
    ({ url, title, triggerElement }: OpenYouTubeVideoOptions) => {
      const target = resolveYouTubeTarget(url);
      if (target.kind !== "video") return;
      triggerRef.current = triggerElement ?? null;
      setActiveVideo((current) => {
        if (current?.videoId === target.videoId) {
          return current;
        }
        return {
          videoId: target.videoId,
          originalUrl: target.originalUrl,
          title,
        };
      });
      setMinimized(false);
    },
    []
  );

  const value = useMemo<YouTubePlayerContextValue>(
    () => ({
      activeVideo,
      minimized,
      openVideo,
      closeVideo,
      minimizeVideo: () => setMinimized(true),
      restoreVideo: () => setMinimized(false),
      updatePosition: setPosition,
      updateDimensions: setDimensions,
    }),
    [activeVideo, closeVideo, minimized, openVideo]
  );

  return (
    <YouTubePlayerContext.Provider value={value}>
      {children}
      <YouTubeVideoPlayer
        messages={messages}
        activeVideo={activeVideo}
        minimized={minimized}
        position={position}
        dimensions={dimensions}
        onClose={closeVideo}
        onMinimize={() => setMinimized(true)}
        onRestore={() => setMinimized(false)}
        onPositionChange={setPosition}
        onDimensionsChange={setDimensions}
      />
    </YouTubePlayerContext.Provider>
  );
}

export function useYouTubePlayer() {
  const context = useContext(YouTubePlayerContext);
  if (!context) {
    throw new Error("useYouTubePlayer must be used within YouTubePlayerProvider");
  }
  return context;
}
