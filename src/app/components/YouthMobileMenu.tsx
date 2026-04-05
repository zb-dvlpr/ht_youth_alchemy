"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";

export type YouthMobileView =
  | "playerDetails"
  | "skillsMatrix"
  | "ratingsMatrix"
  | "lineupOptimizer";

type YouthMobileMenuProps = {
  messages: Messages;
  youthTeams: { youthTeamId: number; youthTeamName: string }[];
  selectedYouthTeamId: number | null;
  onHome: () => void;
  onTeamChange: (teamId: number) => void;
  onRefresh: () => void;
  onOpenUpdates: () => void;
  activeView: YouthMobileView;
  onSelectView: (view: YouthMobileView) => void;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
};

const MENU_BUTTON_SIZE = 44;
const MENU_WIDTH = 248;
const VIEWPORT_PADDING = 12;
const DRAG_THRESHOLD = 6;

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

export default function YouthMobileMenu({
  messages,
  youthTeams,
  selectedYouthTeamId,
  onHome,
  onTeamChange,
  onRefresh,
  onOpenUpdates,
  activeView,
  onSelectView,
  position,
  onPositionChange,
}: YouthMobileMenuProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragged: boolean;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewport = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const resolvedPosition =
    viewport.width > 0 && viewport.height > 0
      ? clampPosition(position, viewport)
      : position;

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
    onPositionChange(clamped);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: resolvedPosition.x,
      originY: resolvedPosition.y,
      dragged: false,
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
    if (!drag.dragged) return;
    const nextPosition = {
      x: drag.originX + deltaX,
      y: drag.originY + deltaY,
    };
    const clamped =
      viewport.width > 0 && viewport.height > 0
        ? clampPosition(nextPosition, viewport)
        : nextPosition;
    onPositionChange(clamped);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
    if (drag.dragged) {
      commitPosition(position);
      return;
    }
    setOpen((prev) => !prev);
  };

  const handleViewSelect = (view: YouthMobileView) => {
    onSelectView(view);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.mobileYouthMenuButton}
        style={{ left: `${resolvedPosition.x}px`, top: `${resolvedPosition.y}px` }}
        aria-label={messages.mobileYouthMenuToggleLabel}
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
          {youthTeams.length > 1 ? (
            <label className={styles.mobileYouthMenuField}>
              <span className={styles.mobileYouthMenuLabel}>
                {messages.youthTeamLabel}
              </span>
              <select
                className={styles.mobileYouthMenuSelect}
                value={selectedYouthTeamId ?? ""}
                onChange={(event) => {
                  const nextId = Number(event.target.value);
                  if (Number.isNaN(nextId)) return;
                  onTeamChange(nextId);
                }}
              >
                {youthTeams.map((team) => (
                  <option key={team.youthTeamId} value={team.youthTeamId}>
                    {team.youthTeamName}
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
              activeView === "playerDetails" ? styles.mobileYouthMenuActionActive : ""
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
        </div>
      ) : null}
    </>
  );
}
