"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";

export type MobileToolView =
  | "playerDetails"
  | "skillsMatrix"
  | "ratingsMatrix"
  | "lineupOptimizer"
  | "help";

type MobileToolMenuProps = {
  messages: Messages;
  toggleLabel: string;
  teamLabel: string;
  teamOptions: { id: number; label: string }[];
  selectedTeamId: number | null;
  onHome: () => void;
  onOpenHelp: () => void;
  onOpenPlayerList: () => void;
  onTeamChange: (teamId: number) => void;
  onRefresh: () => void;
  onOpenUpdates: () => void;
  activeView: MobileToolView;
  playerListActive?: boolean;
  onSelectView: (view: MobileToolView) => void;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
};

const MENU_BUTTON_SIZE = 44;
const MENU_WIDTH = 248;
const VIEWPORT_PADDING = 12;
const DRAG_THRESHOLD = 6;
const MOMENTUM_MIN_SPEED = 0.12;
const MOMENTUM_MAX_SPEED = 1.7;
const MOMENTUM_LAUNCH_MULTIPLIER = 1.2;
const MOMENTUM_FRICTION = 0.88;
const MOMENTUM_STOP_SPEED = 0.025;
const WALL_BOUNCE_DAMPING = 0.55;

function clampPosition(
  position: { x: number; y: number },
  viewport: { width: number; height: number }
) {
  const maxX = Math.max(
    VIEWPORT_PADDING,
    viewport.width - MENU_BUTTON_SIZE - VIEWPORT_PADDING
  );
  const maxY = Math.max(
    VIEWPORT_PADDING,
    viewport.height - MENU_BUTTON_SIZE - VIEWPORT_PADDING
  );
  return {
    x: Math.min(Math.max(VIEWPORT_PADDING, position.x), maxX),
    y: Math.min(Math.max(VIEWPORT_PADDING, position.y), maxY),
  };
}

export default function MobileToolMenu({
  messages,
  toggleLabel,
  teamLabel,
  teamOptions,
  selectedTeamId,
  onHome,
  onOpenHelp,
  onOpenPlayerList,
  onTeamChange,
  onRefresh,
  onOpenUpdates,
  activeView,
  playerListActive = false,
  onSelectView,
  position,
  onPositionChange,
}: MobileToolMenuProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragged: boolean;
    lastX: number;
    lastY: number;
    lastTimestamp: number;
    velocityX: number;
    velocityY: number;
  } | null>(null);
  const momentumFrameRef = useRef<number | null>(null);
  const momentumActiveRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [displayPosition, setDisplayPosition] = useState(position);
  const [positionAnimating, setPositionAnimating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewport = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(
    () => () => {
      if (momentumFrameRef.current !== null) {
        window.cancelAnimationFrame(momentumFrameRef.current);
      }
    },
    []
  );

  const basePosition = positionAnimating ? displayPosition : position;
  const resolvedPosition =
    viewport.width > 0 && viewport.height > 0
      ? clampPosition(basePosition, viewport)
      : basePosition;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target ?? null)) return;
      if (menuRef.current?.contains(target ?? null)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const menuPosition = useMemo(() => {
    const topBelow = resolvedPosition.y + MENU_BUTTON_SIZE + 8;
    const maxLeft = Math.max(
      VIEWPORT_PADDING,
      viewport.width - MENU_WIDTH - VIEWPORT_PADDING
    );
    const left = Math.min(Math.max(VIEWPORT_PADDING, resolvedPosition.x), maxLeft);
    const estimatedHeight = 330;
    const canOpenBelow =
      viewport.height === 0 ||
      topBelow + estimatedHeight <= viewport.height - VIEWPORT_PADDING;
    return {
      left,
      top: canOpenBelow
        ? topBelow
        : Math.max(VIEWPORT_PADDING, resolvedPosition.y - estimatedHeight - 8),
    };
  }, [resolvedPosition.x, resolvedPosition.y, viewport.height, viewport.width]);

  const commitPosition = (nextPosition: { x: number; y: number }) => {
    const clamped =
      viewport.width > 0 && viewport.height > 0
        ? clampPosition(nextPosition, viewport)
        : nextPosition;
    setDisplayPosition(clamped);
    setPositionAnimating(false);
    onPositionChange(clamped);
  };

  const stopMomentum = () => {
    if (momentumFrameRef.current !== null) {
      window.cancelAnimationFrame(momentumFrameRef.current);
      momentumFrameRef.current = null;
    }
    momentumActiveRef.current = false;
  };

  const startMomentum = (
    nextPosition: { x: number; y: number },
    velocity: { x: number; y: number }
  ) => {
    if (typeof window === "undefined") return;
    stopMomentum();
    momentumActiveRef.current = true;
    let currentPosition = nextPosition;
    let currentVelocity = velocity;

    const step = () => {
      currentVelocity = {
        x: currentVelocity.x * MOMENTUM_FRICTION,
        y: currentVelocity.y * MOMENTUM_FRICTION,
      };

      if (
        Math.abs(currentVelocity.x) < MOMENTUM_STOP_SPEED &&
        Math.abs(currentVelocity.y) < MOMENTUM_STOP_SPEED
      ) {
        commitPosition(currentPosition);
        momentumActiveRef.current = false;
        momentumFrameRef.current = null;
        return;
      }

      const unclampedPosition = {
        x: currentPosition.x + currentVelocity.x * 16,
        y: currentPosition.y + currentVelocity.y * 16,
      };
      if (viewport.width > 0 && viewport.height > 0) {
        const bounds = clampPosition(unclampedPosition, viewport);
        if (bounds.x !== unclampedPosition.x) {
          currentVelocity.x = -currentVelocity.x * WALL_BOUNCE_DAMPING;
        }
        if (bounds.y !== unclampedPosition.y) {
          currentVelocity.y = -currentVelocity.y * WALL_BOUNCE_DAMPING;
        }
        currentPosition = bounds;
      } else {
        currentPosition = unclampedPosition;
      }
      setDisplayPosition(currentPosition);
      momentumFrameRef.current = window.requestAnimationFrame(step);
    };

    momentumFrameRef.current = window.requestAnimationFrame(step);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    stopMomentum();
    setPositionAnimating(true);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: resolvedPosition.x,
      originY: resolvedPosition.y,
      dragged: false,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTimestamp: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.dragged && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
      drag.dragged = true;
    }
    const elapsed = Math.max(1, event.timeStamp - drag.lastTimestamp);
    drag.velocityX = (event.clientX - drag.lastX) / elapsed;
    drag.velocityY = (event.clientY - drag.lastY) / elapsed;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTimestamp = event.timeStamp;
    if (!drag.dragged) return;
    const nextPosition = {
      x: drag.originX + deltaX,
      y: drag.originY + deltaY,
    };
    const clamped =
      viewport.width > 0 && viewport.height > 0
        ? clampPosition(nextPosition, viewport)
        : nextPosition;
    setDisplayPosition(clamped);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
    if (drag.dragged) {
      const releasePosition =
        viewport.width > 0 && viewport.height > 0
          ? clampPosition(
              {
                x: drag.originX + (event.clientX - drag.startX),
                y: drag.originY + (event.clientY - drag.startY),
              },
              viewport
            )
          : {
              x: drag.originX + (event.clientX - drag.startX),
              y: drag.originY + (event.clientY - drag.startY),
            };
      const speed = Math.hypot(drag.velocityX, drag.velocityY);
      if (speed >= MOMENTUM_MIN_SPEED) {
        const launchSpeed = Math.min(
          MOMENTUM_MAX_SPEED,
          speed * MOMENTUM_LAUNCH_MULTIPLIER
        );
        const scale = launchSpeed / speed;
        startMomentum(releasePosition, {
          x: drag.velocityX * scale,
          y: drag.velocityY * scale,
        });
      } else {
        commitPosition(releasePosition);
      }
      return;
    }
    setPositionAnimating(false);
    setOpen((prev) => !prev);
  };

  const handleViewSelect = (view: MobileToolView) => {
    onSelectView(view);
    setOpen(false);
  };

  const openManual = () => {
    window.dispatchEvent(new CustomEvent("ya:manual-open"));
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.mobileYouthMenuButton}
        style={{ left: `${resolvedPosition.x}px`, top: `${resolvedPosition.y}px` }}
        aria-label={toggleLabel}
        aria-expanded={open}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {open ? "▴" : "▾"}
      </button>
      {open ? (
        <div
          ref={menuRef}
          className={styles.mobileYouthMenuDropdown}
          style={{ left: `${menuPosition.left}px`, top: `${menuPosition.top}px` }}
        >
          <button
            type="button"
            className={styles.mobileYouthMenuAction}
            onClick={() => {
              onHome();
              setOpen(false);
            }}
          >
            {messages.mobileHomeLabel}
          </button>
          <div className={styles.mobileYouthMenuDivider} />
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "help" ? styles.mobileYouthMenuActionActive : ""
            }`}
            onClick={() => {
              onOpenHelp();
              setOpen(false);
            }}
          >
            {messages.mobileHelpLabel}
          </button>
          <div className={styles.mobileYouthMenuDivider} />
          {teamOptions.length > 1 ? (
            <label className={styles.mobileYouthMenuField}>
              <span className={styles.mobileYouthMenuLabel}>{teamLabel}</span>
              <select
                className={styles.mobileYouthMenuSelect}
                value={selectedTeamId ?? ""}
                onChange={(event) => {
                  const nextId = Number(event.target.value);
                  if (Number.isNaN(nextId)) return;
                  onTeamChange(nextId);
                }}
              >
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={styles.mobileYouthMenuDivider} />
          <button
            type="button"
            className={styles.mobileYouthMenuAction}
            onClick={() => {
              onRefresh();
              setOpen(false);
            }}
          >
            {messages.refresh}
          </button>
          <button
            type="button"
            className={styles.mobileYouthMenuAction}
            onClick={() => {
              onOpenUpdates();
              setOpen(false);
            }}
          >
            {messages.clubChronicleUpdatesTitle}
          </button>
          <div className={styles.mobileYouthMenuDivider} />
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              playerListActive ? styles.mobileYouthMenuActionActive : ""
            }`}
            onClick={() => {
              onOpenPlayerList();
              setOpen(false);
            }}
          >
            {messages.mobilePlayerListLabel}
          </button>
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "playerDetails" && !playerListActive
                ? styles.mobileYouthMenuActionActive
                : ""
            }`}
            onClick={() => handleViewSelect("playerDetails")}
          >
            {messages.detailsTabLabel}
          </button>
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "skillsMatrix" ? styles.mobileYouthMenuActionActive : ""
            }`}
            onClick={() => handleViewSelect("skillsMatrix")}
          >
            {messages.skillsMatrixTabLabel}
          </button>
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "ratingsMatrix" ? styles.mobileYouthMenuActionActive : ""
            }`}
            onClick={() => handleViewSelect("ratingsMatrix")}
          >
            {messages.ratingsMatrixTabLabel}
          </button>
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "lineupOptimizer"
                ? styles.mobileYouthMenuActionActive
                : ""
            }`}
            onClick={() => handleViewSelect("lineupOptimizer")}
          >
            {messages.lineupTitle}
          </button>
          <div className={styles.mobileYouthMenuDivider} />
          <button
            type="button"
            className={styles.mobileYouthMenuAction}
            onClick={openManual}
          >
            {messages.helpMenuManual}
          </button>
        </div>
      ) : null}
    </>
  );
}
