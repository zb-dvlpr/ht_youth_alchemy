"use client";

import { useEffect } from "react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 1;
const SCALE_EPSILON = 0.002;
const SCALE_FUDGE = 0.995;

function computeScale(container: HTMLElement, viewport: HTMLElement | null) {
  const contentWidth = Math.max(container.scrollWidth, container.offsetWidth);
  const contentHeight = Math.max(container.scrollHeight, container.offsetHeight);
  const viewportWidth = viewport?.clientWidth ?? window.innerWidth;
  const viewportHeight = viewport?.clientHeight ?? window.innerHeight;
  if (!contentWidth || !contentHeight) return 1;
  const scale = Math.min(
    MAX_SCALE,
    viewportWidth / contentWidth,
    viewportHeight / contentHeight
  );
  const adjusted = scale * SCALE_FUDGE;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, adjusted));
}

export default function ViewportScaler() {
  useEffect(() => {
    const container = document.querySelector(
      "[data-scale-container]"
    ) as HTMLElement | null;
    if (!container) return;

    let lastScale = 1;
    let rafId: number | null = null;

    const applyScale = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const viewport = document.querySelector("main") as HTMLElement | null;
        const root = document.documentElement;
        const nextScale = computeScale(container, viewport);
        if (Math.abs(nextScale - lastScale) < SCALE_EPSILON) return;
        lastScale = nextScale;
        root.style.setProperty("--ui-scale", nextScale.toFixed(4));
        root.style.setProperty("--ui-scale-inv", (1 / nextScale).toFixed(4));
      });
    };

    const onUserAction = () => {
      window.setTimeout(applyScale, 0);
    };

    applyScale();
    window.addEventListener("resize", applyScale);
    document.addEventListener("click", onUserAction, true);
    if (document.fonts?.ready) {
      document.fonts.ready.then(applyScale).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("resize", applyScale);
      document.removeEventListener("click", onUserAction, true);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
